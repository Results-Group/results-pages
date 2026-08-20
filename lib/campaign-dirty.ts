/**
 * New-campaign mode (no campaignId yet) never autosaves — the editor refuses
 * to create a row until client + name exist. Everything built before that
 * lives only in memory, so the unsaved-changes guard needs a way to know
 * whether leaving would actually lose work. Pure so it can run under vitest.
 */
export interface NewWorkDoc {
  meta: { client: string; campaignName: string; concept: string }
  sections: readonly unknown[]
}

export function hasUnsavedNewWork(doc: NewWorkDoc, campaignId: string | null): boolean {
  if (campaignId) return false
  return (
    doc.sections.length > 0 ||
    doc.meta.client.trim() !== '' ||
    doc.meta.campaignName.trim() !== '' ||
    doc.meta.concept.trim() !== ''
  )
}
