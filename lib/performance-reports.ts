import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

// ── Block types ──

export type ReportBlockType =
  | 'kpi_grid'
  | 'strategic_note'
  | 'funnel'
  | 'data_rows'
  | 'source_grid'
  | 'table'
  | 'chart'
  | 'insight_box'
  | 'action_list'
  | 'idea_cards'
  | 'text'

export interface KpiItem {
  title: string
  value: string
  subtitle?: string
  trend?: string
  highlight?: boolean
  icon?: string
}

export interface FunnelStage {
  label: string
  value: string
  subtitle?: string
  conversionRate?: string
}

export interface DataRowItem {
  title: string
  description?: string
  stats: { label: string; value: string; highlight?: boolean }[]
}

export interface SourceGridItem {
  platform: string
  value: string
  highlight?: boolean
  budget?: string
  budgetPercent?: number
}

export interface TableColumn {
  key: string
  label: string
  highlight?: boolean
}

export interface InsightStat {
  label: string
  value: string
}

export interface ActionItem {
  title: string
  description: string
  impact?: string
}

export interface IdeaCard {
  title: string
  content: string
  items?: string[]
  fullWidth?: boolean
}

export interface ChartDataset {
  label: string
  data: number[]
  color?: string
}

export interface ReportBlock {
  id: string
  type: ReportBlockType
  title?: string
  // kpi_grid
  kpis?: KpiItem[]
  // strategic_note / text
  content?: string
  variant?: 'cyan' | 'yellow'
  // funnel
  stages?: FunnelStage[]
  summaryCards?: { value: string; label: string }[]
  // data_rows
  rows?: DataRowItem[]
  // source_grid
  sources?: SourceGridItem[]
  // table
  columns?: TableColumn[]
  tableData?: Record<string, string>[]
  // chart
  chartType?: 'line' | 'bar' | 'doughnut'
  labels?: string[]
  datasets?: ChartDataset[]
  // insight_box
  insightTitle?: string
  insightText?: string
  insightStats?: InsightStat[]
  // action_list
  actions?: ActionItem[]
  // idea_cards
  ideas?: IdeaCard[]
}

export interface ReportTab {
  id: string
  title: string
  subtitle?: string
  blocks: ReportBlock[]
}

// ── Main entity ──

export interface PerformanceReport {
  id: string
  client: string
  client_id: string | null
  report_name: string
  slug: string
  period_label: string | null
  tabs: ReportTab[]
  tabs_en: ReportTab[] | null
  status: 'draft' | 'published' | 'archived'
  publish_at: string | null
  password: string | null
  logo_path: string | null
  brand_color: string | null
  workspace_id: string | null
  created_by: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// ── Queries ──

export async function getReports(filters?: {
  search?: string
  status?: string
  workspace_id?: string
  deleted?: boolean
}) {
  let query = supabase
    .from('performance_reports')
    .select('id,client,client_id,report_name,slug,period_label,status,publish_at,password,logo_path,brand_color,workspace_id,created_by,deleted_at,created_at,updated_at')
    .order('created_at', { ascending: false })

  if (filters?.deleted) query = query.not('deleted_at', 'is', null)
  else query = query.is('deleted_at', null)

  if (filters?.workspace_id) query = query.eq('workspace_id', filters.workspace_id)

  if (filters?.search) {
    const s = filters.search.replace(/[%_\\]/g, c => `\\${c}`)
    query = query.or(`report_name.ilike.%${s}%,client.ilike.%${s}%`)
  }
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as PerformanceReport[]
}

export async function getReportById(id: string): Promise<PerformanceReport | null> {
  const { data, error } = await supabase
    .from('performance_reports')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as PerformanceReport
}

export async function getReportBySlug(slug: string): Promise<PerformanceReport | null> {
  const { data, error } = await supabase
    .from('performance_reports')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()
  if (error || !data) return null
  return data as PerformanceReport
}

export async function createReport(data: {
  client: string
  report_name: string
  slug: string
  period_label?: string
  tabs?: ReportTab[]
  tabs_en?: ReportTab[] | null
  status?: string
  publish_at?: string | null
  password?: string
  logo_path?: string
  brand_color?: string
  created_by?: string
  workspace_id?: string
  client_id?: string | null
}): Promise<PerformanceReport> {
  const hashedPw = data.password ? await bcrypt.hash(data.password, 12) : null
  const insertData: Record<string, unknown> = {
    client: data.client,
    report_name: data.report_name,
    slug: data.slug,
    period_label: data.period_label || null,
    tabs: data.tabs || [],
    tabs_en: data.tabs_en || null,
    status: data.status || 'draft',
    publish_at: data.publish_at || null,
    password: hashedPw,
    logo_path: data.logo_path || null,
    brand_color: data.brand_color || null,
  }
  if (data.created_by) insertData.created_by = data.created_by
  if (data.workspace_id) insertData.workspace_id = data.workspace_id
  if (data.client_id !== undefined) insertData.client_id = data.client_id

  const { data: report, error } = await supabase
    .from('performance_reports')
    .insert(insertData)
    .select()
    .single()
  if (error) throw error
  return report as PerformanceReport
}

export async function updateReport(
  id: string,
  data: Partial<Omit<PerformanceReport, 'id' | 'created_at'>>
): Promise<PerformanceReport> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (data.client !== undefined) updateData.client = data.client
  if (data.client_id !== undefined) updateData.client_id = data.client_id
  if (data.report_name !== undefined) updateData.report_name = data.report_name
  if (data.slug !== undefined) updateData.slug = data.slug
  if (data.period_label !== undefined) updateData.period_label = data.period_label
  if (data.tabs !== undefined) updateData.tabs = data.tabs
  if (data.tabs_en !== undefined) updateData.tabs_en = data.tabs_en
  if (data.status !== undefined) updateData.status = data.status
  if (data.publish_at !== undefined) updateData.publish_at = data.publish_at
  if (data.logo_path !== undefined) updateData.logo_path = data.logo_path
  if (data.brand_color !== undefined) updateData.brand_color = data.brand_color
  if (data.workspace_id !== undefined) updateData.workspace_id = data.workspace_id
  if (data.password !== undefined) {
    updateData.password = data.password ? await bcrypt.hash(data.password, 12) : null
  }

  const { data: report, error } = await supabase
    .from('performance_reports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return report as PerformanceReport
}

export async function deleteReport(id: string) {
  const { error } = await supabase
    .from('performance_reports')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function restoreReport(id: string) {
  const { error } = await supabase
    .from('performance_reports')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw error
}

export async function purgeReport(id: string) {
  const { error } = await supabase.from('performance_reports').delete().eq('id', id)
  if (error) throw error
}

// ── Standard report template ──
// Moved to lib/report-template.ts so client components can import it
// without dragging the server-only Supabase client into the browser bundle.
export { createStandardTemplate } from './report-template'
