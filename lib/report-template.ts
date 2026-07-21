// Client-safe report scaffolding.
//
// This lives outside lib/performance-reports.ts on purpose: that module
// imports the server-only Supabase client, so importing a *value* from it
// in a client component pulls the service-role client into the browser
// bundle, where the key is undefined and createClient() throws
// "supabaseKey is required" at module evaluation.
//
// Types may still be imported from performance-reports with `import type`
// (erased at compile time); only runtime values need to live here.

import type { ReportTab } from './performance-reports'

function newBlockId(): string {
  return crypto.randomUUID().slice(0, 8)
}

export function createStandardTemplate(): ReportTab[] {
  return [
    {
      id: crypto.randomUUID(),
      title: 'סיכום ביצועים',
      subtitle: '',
      blocks: [
        { id: newBlockId(), type: 'kpi_grid', title: 'מדדים ראשיים', kpis: [] },
        { id: newBlockId(), type: 'strategic_note', content: '', variant: 'cyan' },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'המשפך השיווקי',
      subtitle: '',
      blocks: [
        { id: newBlockId(), type: 'funnel', title: 'מפנייה לעסקה', stages: [], summaryCards: [] },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'מקורות עסקאות',
      subtitle: '',
      blocks: [
        { id: newBlockId(), type: 'source_grid', title: 'חלוקה לפי מקור', sources: [] },
        { id: newBlockId(), type: 'table', title: 'פילוח מפורט', columns: [], tableData: [] },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'קמפיינים',
      subtitle: '',
      blocks: [
        { id: newBlockId(), type: 'table', title: 'קמפיין × קהל', columns: [], tableData: [] },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'מגמות',
      subtitle: '',
      blocks: [
        { id: newBlockId(), type: 'chart', title: 'מגמות חודשיות', chartType: 'line', labels: [], datasets: [] },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'תובנות והמלצות',
      subtitle: '',
      blocks: [
        { id: newBlockId(), type: 'insight_box', insightTitle: '', insightText: '', insightStats: [] },
        { id: newBlockId(), type: 'action_list', title: 'המלצות', actions: [] },
      ],
    },
  ]
}
