import { describe, it, expect } from 'vitest'
import { matchesStatus, sortCampaigns, groupByClient, clientNames, awaitingFirstView } from '@/lib/campaign-list'

const c = (client: string, created: string, updated?: string, status: 'draft' | 'published' | 'archived' = 'published') =>
  ({ client, created_at: created, updated_at: updated, status })

const list = [
  c('Relax', '2026-09-01T10:00:00Z', '2026-09-20T10:00:00Z'),
  c('BDO', '2026-09-26T09:00:00Z'),                              // newest, never updated
  c('Medera', '2026-09-10T10:00:00Z', '2026-09-11T10:00:00Z'),
  c('', '2026-09-05T10:00:00Z'),
]

describe('matchesStatus', () => {
  it('"active" is the default view: everything except the archive', () => {
    expect(matchesStatus('published', 'active')).toBe(true)
    expect(matchesStatus('draft', 'active')).toBe(true)
    expect(matchesStatus('archived', 'active')).toBe(false)
  })

  it('a named status matches only itself, and "all" matches everything', () => {
    expect(matchesStatus('archived', 'archived')).toBe(true)
    expect(matchesStatus('published', 'archived')).toBe(false)
    expect(matchesStatus('archived', 'all')).toBe(true)
  })
})

describe('sortCampaigns', () => {
  it('created: the campaign made a minute ago comes first', () => {
    expect(sortCampaigns(list, 'created').map(x => x.client)).toEqual(['BDO', 'Medera', '', 'Relax'])
  })

  it('updated: falls back to created_at for a campaign never edited', () => {
    // Relax was edited on the 20th; BDO was created on the 26th and never edited.
    expect(sortCampaigns(list, 'updated').map(x => x.client)).toEqual(['BDO', 'Relax', 'Medera', ''])
  })

  it('client: A→Z with the nameless last, newest first inside a client', () => {
    const withTwo = [...list, c('BDO', '2026-08-01T10:00:00Z')]
    const sorted = sortCampaigns(withTwo, 'client', 'en')
    expect(sorted.map(x => `${x.client}:${x.created_at.slice(5, 10)}`))
      .toEqual([':09-05', 'BDO:09-26', 'BDO:08-01', 'Medera:09-10', 'Relax:09-01'])
  })

  it('does not mutate the array it is given', () => {
    const copy = [...list]
    sortCampaigns(list, 'created')
    expect(list).toEqual(copy)
  })
})

describe('groupByClient', () => {
  it('keeps the incoming order and labels the nameless group', () => {
    const groups = groupByClient(sortCampaigns(list, 'client', 'en'), 'ללא לקוח')
    expect(groups.map(([name, rows]) => `${name}:${rows.length}`)).toEqual(['ללא לקוח:1', 'BDO:1', 'Medera:1', 'Relax:1'])
  })
})

describe('clientNames', () => {
  it('lists each client once, sorted, without the empty name', () => {
    expect(clientNames([...list, c('BDO', '2026-01-01T00:00:00Z')], 'en')).toEqual(['BDO', 'Medera', 'Relax'])
  })
})

describe('awaitingFirstView', () => {
  const NOW = new Date('2026-09-27T12:00:00Z').getTime()
  const pub = (over: Record<string, unknown> = {}) => ({ status: 'published', created_at: '2026-09-25T09:00:00Z', view_stats: null, ...over })

  it('flags a campaign published over a day ago that nobody outside the team opened', () => {
    expect(awaitingFirstView(pub(), NOW)).toBe(true)
  })

  it('stays quiet once the client opened it', () => {
    expect(awaitingFirstView(pub({ view_stats: { count: 3 } }), NOW)).toBe(false)
  })

  it('gives a fresh campaign its first day', () => {
    expect(awaitingFirstView(pub({ created_at: '2026-09-27T01:00:00Z' }), NOW)).toBe(false)
  })

  it('counts from a scheduled publish date, not from creation', () => {
    expect(awaitingFirstView(pub({ publish_at: '2026-09-27T08:00:00Z' }), NOW)).toBe(false)
  })

  it('never flags drafts or the archive', () => {
    expect(awaitingFirstView(pub({ status: 'draft' }), NOW)).toBe(false)
    expect(awaitingFirstView(pub({ status: 'archived' }), NOW)).toBe(false)
  })
})
