import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { geminiGenerateJson, isAiConfigured } from '@/lib/ai'
import type { ReportTab } from '@/lib/performance-reports'
import { captureException } from '@/lib/logger'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const authErr = await requireAuth(request)
  if (authErr) return authErr

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI לא מוגדר — חסר GEMINI_API_KEY' }, { status: 503 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'לא צורף קובץ' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      return NextResponse.json({ error: 'פורמט לא נתמך — נא להעלות קובץ Excel או CSV' }, { status: 400 })
    }

    // Parse the workbook
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Extract all sheets as JSON
    const sheetsData: Record<string, unknown[][]> = {}
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      sheetsData[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
    }

    // Truncate to keep the prompt manageable (max ~15K chars of data)
    const rawText = JSON.stringify(sheetsData)
    const truncated = rawText.length > 15000 ? rawText.slice(0, 15000) + '...[truncated]' : rawText

    const prompt = `You are a data analyst for a digital marketing agency. You receive raw spreadsheet data from a performance report. Your job is to convert it into a structured report format.

The report structure is an array of tabs. Each tab has: id (UUID string), title, subtitle (optional), and blocks (array).

Block types and their fields:
- kpi_grid: { type: "kpi_grid", id, title?, kpis: [{ title, value, subtitle?, trend?, highlight? }] }
- strategic_note: { type: "strategic_note", id, content, variant: "cyan"|"yellow" }
- funnel: { type: "funnel", id, title?, stages: [{ label, value, subtitle?, conversionRate? }], summaryCards?: [{ value, label }] }
- data_rows: { type: "data_rows", id, title?, rows: [{ title, description?, stats: [{ label, value, highlight? }] }] }
- source_grid: { type: "source_grid", id, title?, sources: [{ platform, value, highlight?, budget?, budgetPercent? }] }
- table: { type: "table", id, title?, columns: [{ key, label, highlight? }], tableData: [{ [key]: value }] }
- chart: { type: "chart", id, title?, chartType: "line"|"bar"|"doughnut", labels: string[], datasets: [{ label, data: number[], color? }] }
- insight_box: { type: "insight_box", id, insightTitle, insightText, insightStats?: [{ value, label }] }
- action_list: { type: "action_list", id, title?, actions: [{ title, description, impact? }] }
- idea_cards: { type: "idea_cards", id, ideas: [{ title, content, fullWidth? }] }
- text: { type: "text", id, content, variant?: "cyan"|"yellow" }

Generate unique IDs (8 char) for each block.

RULES:
- Analyze the data and organize it into meaningful tabs
- Use appropriate block types based on the data
- Keep all numbers, currencies, and percentages as strings
- If data has monthly trends, create a chart block
- If data has KPI summaries, create kpi_grid blocks
- If data has tabular data, create table blocks
- Return ONLY a valid JSON array of tabs

Raw spreadsheet data:
${truncated}`

    const tabs = await geminiGenerateJson<ReportTab[]>(prompt)

    if (!Array.isArray(tabs)) {
      return NextResponse.json({ error: 'פענוח נכשל — AI לא החזיר פורמט תקין' }, { status: 500 })
    }

    return NextResponse.json({ tabs })
  } catch (err) {
    captureException(err, { route: 'POST /api/reports/import-excel' })
    return NextResponse.json({ error: 'שגיאה בייבוא קובץ' }, { status: 500 })
  }
}
