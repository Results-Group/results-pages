import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getSessionFromRequest = vi.fn()
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: (...a: unknown[]) => getSessionFromRequest(...a) }))

const { requirePurgeConfirmation } = await import('@/lib/purge-guard')

const req = (confirm?: string) =>
  new NextRequest(
    `https://example.com/api/pages/1?purge=1${confirm !== undefined ? `&confirm=${encodeURIComponent(confirm)}` : ''}`,
    { method: 'DELETE' }
  )

const asRole = (role: string, isOwner = false) => ({ userId: 'u1', email: 'a@b.c', name: 'A', role, isOwner })

describe('requirePurgeConfirmation', () => {
  beforeEach(() => getSessionFromRequest.mockReset())

  it('lets an admin through when the name matches exactly', async () => {
    getSessionFromRequest.mockResolvedValue(asRole('admin'))
    expect(await requirePurgeConfirmation(req('דוח יולי'), 'דוח יולי')).toBeNull()
  })

  it('lets the owner through', async () => {
    getSessionFromRequest.mockResolvedValue(asRole('editor', true))
    expect(await requirePurgeConfirmation(req('Campaign X'), 'Campaign X')).toBeNull()
  })

  it('refuses an editor even with the right name — purge is admin-only', async () => {
    getSessionFromRequest.mockResolvedValue(asRole('editor'))
    const res = await requirePurgeConfirmation(req('Campaign X'), 'Campaign X')
    expect(res?.status).toBe(403)
  })

  it('refuses when no confirmation is supplied — the old one-parameter delete', async () => {
    getSessionFromRequest.mockResolvedValue(asRole('admin'))
    const res = await requirePurgeConfirmation(req(), 'Campaign X')
    expect(res?.status).toBe(400)
    expect(await res!.json()).toMatchObject({ requiredConfirmation: 'Campaign X' })
  })

  it('refuses a near-miss rather than guessing intent', async () => {
    getSessionFromRequest.mockResolvedValue(asRole('admin'))
    expect((await requirePurgeConfirmation(req('Campaign'), 'Campaign X'))?.status).toBe(400)
    expect((await requirePurgeConfirmation(req('campaign x'), 'Campaign X'))?.status).toBe(400)
  })

  it('tolerates surrounding whitespace from a paste', async () => {
    getSessionFromRequest.mockResolvedValue(asRole('admin'))
    expect(await requirePurgeConfirmation(req('  Campaign X  '), 'Campaign X')).toBeNull()
  })

  it('refuses an unauthenticated caller', async () => {
    getSessionFromRequest.mockResolvedValue(null)
    expect((await requirePurgeConfirmation(req('X'), 'X'))?.status).toBe(401)
  })
})
