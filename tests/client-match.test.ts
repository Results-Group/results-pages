import { describe, it, expect } from 'vitest'
import { filterClients, resolveTypedClient } from '@/lib/client-match'

const clients = [
  { id: '1', name: 'Dr. Oksana - דר. אוקסנה נייזוב' },
  { id: '2', name: 'הראלה ישי - Harella ishai' },
  { id: '3', name: 'Cycles Trading' },
  { id: '4', name: 'Xtra' },
]

describe('resolveTypedClient', () => {
  it('half a word is never committed on its own — the 8.9 "או" incident', () => {
    const r = resolveTypedClient('או', '', clients)
    expect(r.kind).toBe('new')
    // …and the confirmation can point at who was probably meant.
    expect(r.kind === 'new' && r.similar.map(c => c.id)).toEqual(['1'])
  })

  it('an existing client typed in another spelling is that client, not a new one', () => {
    expect(resolveTypedClient('xtra', '', clients)).toMatchObject({ kind: 'existing', client: { id: '4' } })
    expect(resolveTypedClient('cycles-trading', '', clients)).toMatchObject({ kind: 'existing', client: { id: '3' } })
  })

  it('leaves the value alone when nothing changed, and clears when emptied', () => {
    expect(resolveTypedClient('Xtra', 'Xtra', clients)).toEqual({ kind: 'unchanged' })
    expect(resolveTypedClient('   ', 'Xtra', clients)).toEqual({ kind: 'clear' })
  })

  it('a genuinely new name is offered as new, with no false suggestions', () => {
    expect(resolveTypedClient('Brand New Co', '', clients)).toEqual({ kind: 'new', name: 'Brand New Co', similar: [] })
  })
})

describe('filterClients', () => {
  it('finds by substring in either language, and loosely across separators', () => {
    expect(filterClients('הראלה', clients).map(c => c.id)).toEqual(['2'])
    expect(filterClients('cycles trading', clients).map(c => c.id)).toEqual(['3'])
    expect(filterClients('', clients)).toHaveLength(4)
  })
})
