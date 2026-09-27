import { clientNameKey } from './client-name'

/**
 * What the client field does with what was typed. Client-safe, pure.
 *
 * The field used to hand every keystroke to its parent as the client name,
 * with no client id — and the campaign editor autosaves, so the server's
 * find-or-create minted a client from half a word. That is where "או"
 * (on the way to "אוקסנה") and "HAR" (on the way to "הראלה") came from,
 * both on 2026-09-08, each with real campaigns attached. Typing now only
 * filters; a name is committed by picking it, by typing an existing name in
 * any spelling, or by confirming a brand-new one.
 */

export interface MatchableClient { id: string; name: string }

export type TypedResolution<C extends MatchableClient> =
  | { kind: 'unchanged' }
  | { kind: 'clear' }
  | { kind: 'existing'; client: C }
  | { kind: 'new'; name: string; similar: C[] }

/** Clients to list while typing: by plain substring, or loosely ("cycles trading" finds "Cycles-Trading"). */
export function filterClients<C extends MatchableClient>(typed: string, clients: C[]): C[] {
  const t = typed.trim().toLowerCase()
  if (!t) return clients
  const key = clientNameKey(t)
  return clients.filter(c => c.name.toLowerCase().includes(t) || (!!key && clientNameKey(c.name).includes(key)))
}

export function resolveTypedClient<C extends MatchableClient>(typed: string, current: string, clients: C[]): TypedResolution<C> {
  const t = typed.trim()
  if (t === current.trim()) return { kind: 'unchanged' }
  if (!t) return { kind: 'clear' }
  const key = clientNameKey(t)
  const same = clients.find(c => c.name === t) ?? (key ? clients.find(c => clientNameKey(c.name) === key) : undefined)
  if (same) return { kind: 'existing', client: same }
  return { kind: 'new', name: t, similar: filterClients(t, clients).slice(0, 3) }
}
