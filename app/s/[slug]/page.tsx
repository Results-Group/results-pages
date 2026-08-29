import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getStrategyDocBySlug } from '@/lib/strategy-docs'
import { getClientById } from '@/lib/clients'
import { getSession, canStaffViewResource } from '@/lib/auth'
import { assetProxyUrl } from '@/lib/asset-url'
import { buildStrategySlides } from '@/lib/strategy/slides'
import { databaseReachable, rebuildHold } from '@/lib/db-health'
import MaintenancePage from '../../c/[slug]/maintenance'
import ContentUnavailable from '../../_deck/unavailable'
import { headers } from 'next/headers'
import { recordDeckView } from '@/lib/deck-views'
import StrategyPresentation from './presentation'

/**
 * The public brand-positioning deck.
 *
 * No password and no expiry, by product decision — these links stay open. The
 * only gate is `status`, so a half-built document isn't served at a URL that
 * has already been shared.
 */

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const doc = await getStrategyDocBySlug(slug)

  if (!doc) {
    if (rebuildHold() || !(await databaseReachable())) {
      return { title: 'המסמך בעדכון | Results Digital', robots: { index: false, follow: false } }
    }
    return { title: 'הדף לא נמצא | Results Digital', robots: { index: false, follow: false } }
  }

  const title = `${doc.client} – ${doc.doc_name}`
  return {
    title: `${title} | Results Digital`,
    description: `מסמך אסטרטגיה עבור ${doc.client}`,
    // A positioning document is a brand's confidential strategy. It is more
    // sensitive than a campaign deck, not less — never indexed, whatever its
    // status. The slug is not a secret, so this is the only thing keeping it
    // out of search results.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      type: 'website',
      siteName: 'Results Digital',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Results Digital' }],
    },
    twitter: { card: 'summary_large_image', title, images: ['/og-image.png'] },
  }
}

export default async function StrategyDocPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  const doc = await getStrategyDocBySlug(slug)

  if (!doc) {
    // Outage or rebuild, not absence: clients hold these links, so they must
    // see "we're on it" rather than a 404. Same rule as the campaign deck.
    if (rebuildHold() || !(await databaseReachable())) return <MaintenancePage />
    notFound()
  }

  const session = await getSession()
  // Scoped to the document's workspace — see the note in app/c/[slug]/page.tsx.
  // A positioning document is a brand's confidential strategy.
  const isStaff = await canStaffViewResource(doc.workspace_id)
  const isPreview = sp.preview === '1' && isStaff

  if (doc.status !== 'published' && !isPreview) return <ContentUnavailable variant="not_published" />

  // Branding: the document's own logo if one was uploaded, else the client's.
  let logoPath = doc.logo_path
  if (!logoPath && doc.client_id) {
    const client = await getClientById(doc.client_id)
    if (client?.logo_path) logoPath = client.logo_path
  }

  // The cover eyebrow reads as an English date line, matching the campaign deck.
  const date = new Date(doc.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const slides = buildStrategySlides({
    meta: {
      client: doc.client,
      clientId: doc.client_id,
      docName: doc.doc_name,
      logoPath,
      logoUrl: logoPath ? assetProxyUrl(logoPath) : null,
      workspaceId: doc.workspace_id,
    },
    sections: doc.sections,
    date,
  })

  // Client view (published, no staff session) — fire-and-forget.
  if (!session) {
    const hdrs = await headers()
    recordDeckView({
      content_type: 'strategy',
      content_id: doc.id,
      ip: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      user_agent: hdrs.get('user-agent') || undefined,
    }).catch(() => {})
  }

  return (
    <StrategyPresentation
      slides={slides}
      clientName={doc.client}
      docName={doc.doc_name}
    />
  )
}
