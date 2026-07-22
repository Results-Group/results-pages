// Copy helpers that safe to import from client bundles. lib/campaigns.ts pulls
// in sharp + bcrypt + supabase-service, so anything the editor/preview needs
// lives here instead.

import type { CampaignSection } from './campaigns'

/** A single ad-text variation on a campaign. `label` is optional
 *  ("לגברים", "לנשים"); when empty the presentation falls back to "גרסה N". */
export interface Copy {
  id: string
  label: string
  body: string
}

/** Normalize a copies value that may be legacy string[] or new Copy[]. */
export function normalizeCopies(raw: unknown): Copy[] {
  if (!Array.isArray(raw)) return []
  const out: Copy[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      out.push({ id: crypto.randomUUID(), label: '', body: item })
    } else if (item && typeof item === 'object') {
      const c = item as Partial<Copy>
      out.push({
        id: c.id || crypto.randomUUID(),
        label: c.label || '',
        body: c.body || '',
      })
    }
  }
  return out
}

/** Resolve which copies apply to a section, honouring the legacy useCopies flag. */
export function resolveSectionCopies(
  section: Pick<CampaignSection, 'copyIds' | 'useCopies'>,
  allCopies: Copy[],
): Copy[] {
  if (Array.isArray(section.copyIds)) {
    const ids = new Set(section.copyIds)
    return allCopies.filter(c => ids.has(c.id))
  }
  // Legacy row without copyIds — useCopies=true meant "all copies", else none.
  return section.useCopies ? allCopies : []
}
