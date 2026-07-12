import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireResourcePermission } from '@/lib/auth'
import { getReportById, updateReport } from '@/lib/performance-reports'
import type { ReportTab } from '@/lib/performance-reports'
import { geminiGenerateJson, isAiConfigured } from '@/lib/ai'
import { captureException } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit(request, { windowMs: 60_000, max: 5, prefix: 'ai-translate' })
  if (rl) return rl

  const { id } = await params

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI לא מוגדר — חסר GEMINI_API_KEY' }, { status: 503 })
  }

  try {
    const report = await getReportById(id)
    if (!report) return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 })

    const permErr = await requireResourcePermission(request, report.workspace_id, 'edit')
    if (permErr) return permErr

    const body = await request.json()
    const direction: 'he-to-en' | 'en-to-he' = body.direction || 'he-to-en'

    const sourceTabs = direction === 'he-to-en' ? report.tabs : (report.tabs_en || report.tabs)
    const targetLang = direction === 'he-to-en' ? 'English' : 'Hebrew'
    const sourceLang = direction === 'he-to-en' ? 'Hebrew' : 'English'

    const prompt = `You are a professional translator for a digital marketing agency. Translate the following report data from ${sourceLang} to ${targetLang}.

IMPORTANT RULES:
- Translate ONLY text content (titles, descriptions, subtitles, content, labels, trends, insights, actions, ideas)
- Keep numbers, percentages, currency symbols, dates, URLs, and brand names (Google, Meta, TikTok, etc.) EXACTLY as they are
- Keep all JSON structure keys exactly the same
- Professional marketing terminology — use industry-standard terms
- Maintain the same tone: professional, data-driven, concise
- Return ONLY a valid JSON array with the same structure

Input JSON:
${JSON.stringify(sourceTabs, null, 2)}`

    const translated = await geminiGenerateJson<ReportTab[]>(prompt)

    if (!Array.isArray(translated)) {
      return NextResponse.json({ error: 'תרגום נכשל — תוצאה לא תקינה' }, { status: 500 })
    }

    if (direction === 'he-to-en') {
      await updateReport(id, { tabs_en: translated })
    } else {
      await updateReport(id, { tabs: translated })
    }

    return NextResponse.json({
      success: true,
      direction,
      tabs: translated,
    })
  } catch (err) {
    captureException(err, { route: 'POST /api/reports/[id]/translate', id })
    return NextResponse.json({ error: 'שגיאה בתרגום' }, { status: 500 })
  }
}
