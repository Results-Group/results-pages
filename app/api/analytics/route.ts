import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getUserWorkspaces } from '@/lib/workspaces'
import { supabase } from '@/lib/supabase'
import { captureException } from '@/lib/logger'

function deviceFromUA(ua: string | null): 'mobile' | 'desktop' {
  if (!ua) return 'desktop'
  return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua) ? 'mobile' : 'desktop'
}

const DAY_MS = 24 * 60 * 60 * 1000
const PAGE_SIZE = 1000
const IN_CHUNK_SIZE = 200

interface ViewRow {
  page_id: string | null
  viewed_at: string
  user_agent: string | null
}

/** Fetch all matching views, paginating past PostgREST's 1,000-row cap. */
async function fetchViews(sinceIso: string, pageIds?: string[]): Promise<ViewRow[]> {
  const rows: ViewRow[] = []
  let offset = 0
  for (;;) {
    let query = supabase
      .from('landing_page_views')
      .select('page_id, viewed_at, user_agent')
      .gte('viewed_at', sinceIso)
      .order('viewed_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (pageIds) query = query.in('page_id', pageIds)

    const { data, error } = await query
    if (error) throw error
    const batch = (data || []) as ViewRow[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner && session.role === 'viewer') {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 30))
  // Anchor to UTC midnight so the buckets are whole days ending at today's date
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const since = new Date(todayUtc - (days - 1) * DAY_MS)

  try {
    // Workspace scoping: admins/owners see everything, other roles only the
    // pages of workspaces they are members of.
    let scopedPageIds: string[] | null = null
    if (!(session.isOwner || session.role === 'admin')) {
      const memberships = await getUserWorkspaces(session.userId)
      const workspaceIds = memberships.map(w => w.id)
      if (workspaceIds.length === 0) {
        scopedPageIds = []
      } else {
        const { data: pages, error: pagesError } = await supabase
          .from('landing_pages')
          .select('id')
          .in('workspace_id', workspaceIds)
        if (pagesError) throw pagesError
        scopedPageIds = (pages || []).map(p => p.id as string)
      }
    }

    let rows: ViewRow[] = []
    if (scopedPageIds === null) {
      rows = await fetchViews(since.toISOString())
    } else if (scopedPageIds.length > 0) {
      for (let i = 0; i < scopedPageIds.length; i += IN_CHUNK_SIZE) {
        rows.push(...await fetchViews(since.toISOString(), scopedPageIds.slice(i, i + IN_CHUNK_SIZE)))
      }
    }

    // Views over time (per day, last bucket = today)
    const byDay: Record<string, number> = {}
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * DAY_MS)
      byDay[d.toISOString().slice(0, 10)] = 0
    }
    // Device split
    const devices = { mobile: 0, desktop: 0 }
    // Per page totals
    const perPage: Record<string, number> = {}

    for (const v of rows) {
      const day = String(v.viewed_at).slice(0, 10)
      if (day in byDay) byDay[day]++
      devices[deviceFromUA(v.user_agent)]++
      if (v.page_id) perPage[v.page_id] = (perPage[v.page_id] || 0) + 1
    }

    // Resolve page titles for the top pages
    const topPageIds = Object.entries(perPage).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id)
    let titles: Record<string, string> = {}
    if (topPageIds.length > 0) {
      const { data: pages } = await supabase.from('landing_pages').select('id, title, client').in('id', topPageIds)
      titles = Object.fromEntries((pages || []).map(p => [p.id, p.title || p.client || 'ללא שם']))
    }

    const timeseries = Object.entries(byDay).map(([date, count]) => ({ date, count }))
    const topPages = topPageIds.map(id => ({ id, title: titles[id] || 'לא ידוע', views: perPage[id] }))

    return NextResponse.json({
      total: rows.length,
      days,
      timeseries,
      devices,
      topPages,
    })
  } catch (err) {
    captureException(err, { route: 'GET /api/analytics' })
    return NextResponse.json({ error: 'שגיאה בטעינת אנליטיקס' }, { status: 500 })
  }
}
