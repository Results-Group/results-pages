import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireResourcePermission } from '@/lib/auth'
import { getPageById, downloadFile, uploadFile, setPageTranslation } from '@/lib/db'
import { extractSegments, restoreSegments, flipDirection, chunkSegments, segmentTexts } from '@/lib/html-translate'
import { geminiGenerateJson, isAiConfigured } from '@/lib/ai'
import { minifyHtml } from '@/lib/minify'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Translates an uploaded Hebrew HTML page into English, stored as a sibling
 * storage object (X.en.html) that the serve route returns at ?lang=en.
 * Markup never reaches the model — only the extracted text segments do
 * (lib/html-translate). Re-running overwrites the previous translation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Keyed per account, not per IP — the whole team shares one office NAT IP,
  // and a bulk translate from one operator must not lock everyone else out.
  const rl = await rateLimit(request, { windowMs: 60_000, max: 20, prefix: 'ai-translate-page', key: session.userId })
  if (rl) return rl

  const { id } = await params

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI לא מוגדר — חסר GEMINI_API_KEY' }, { status: 503 })
  }

  try {
    const page = await getPageById(id)
    if (!page) return NextResponse.json({ error: 'דף לא נמצא' }, { status: 404 })

    const permErr = await requireResourcePermission(request, page.workspace_id, 'edit')
    if (permErr) return permErr

    // Prefer the pretty source over the minified served file — cleaner
    // segment boundaries for the model.
    const sourcePath = page.file_path.replace(/\.html$/, '.source.html')
    const html = (await downloadFile(sourcePath)) ?? (await downloadFile(page.file_path))
    if (!html) return NextResponse.json({ error: 'הקובץ לא נמצא' }, { status: 404 })

    const { masked, segments } = extractSegments(html)
    if (!segments.length) {
      return NextResponse.json({ error: 'לא נמצא טקסט בעברית לתרגום בדף הזה' }, { status: 409 })
    }

    const translated: string[] = []
    for (const batch of chunkSegments(segmentTexts(segments))) {
      const prompt = `You are a professional translator for a digital marketing agency. Translate the following Hebrew text segments to English.

IMPORTANT RULES:
- The input is a JSON array of strings extracted from a marketing performance report
- Return ONLY a valid JSON array of strings with EXACTLY ${batch.length} items, translated in the same order
- Keep numbers, percentages, currency symbols (₪), dates, URLs and brand names (Google, Meta, TikTok, etc.) EXACTLY as they are
- Professional performance-marketing terminology (ROAS, CPA, conversion rate, media spend, leads, funnel)
- Return PLAIN TEXT only: never add HTML tags, quotes around the whole value, or markup of any kind (the segments are text extracted from a page; anything tag-like is escaped on the way back and would show up literally)
- Maintain the tone: professional, data-driven, concise

Input JSON:
${JSON.stringify(batch)}`

      // One retry per batch: length mismatches are the common model slip.
      let out = await geminiGenerateJson<string[]>(prompt)
      if (!Array.isArray(out) || out.length !== batch.length) {
        out = await geminiGenerateJson<string[]>(prompt)
      }
      if (!Array.isArray(out) || out.length !== batch.length) {
        return NextResponse.json({ error: 'תרגום נכשל — אורך תוצאה לא תקין. נסו שוב.' }, { status: 500 })
      }
      translated.push(...out.map(String))
    }

    const englishHtml = flipDirection(restoreSegments(masked, segments, translated))

    const enPath = page.file_path.replace(/\.html$/, '.en.html')
    await uploadFile(enPath, Buffer.from(minifyHtml(englishHtml), 'utf-8'))

    const now = new Date().toISOString()
    await setPageTranslation(id, { en_file_path: enPath, en_translated_at: now, en_stale: false })

    await logAudit({ actor: session, action: 'update', entity_type: 'page', entity_id: id, entity_label: `${page.title} (תרגום לאנגלית)`, workspace_id: page.workspace_id })

    return NextResponse.json({ success: true, en_file_path: enPath, segments: segments.length })
  } catch (err) {
    captureException(err, { route: 'POST /api/pages/[id]/translate', id })
    return NextResponse.json({ error: 'שגיאה בתרגום הדף' }, { status: 500 })
  }
}
