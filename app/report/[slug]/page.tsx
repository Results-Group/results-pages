import { notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { Metadata } from 'next'
import { getReportBySlug } from '@/lib/performance-reports'
import { getClientById } from '@/lib/clients'
import { getSession } from '@/lib/auth'
import { verifyAccessToken } from '@/lib/content-access'
import ReportPresentation from './report-presentation'
import PasswordGate from './password-gate'
import MaintenancePage from '../../c/[slug]/maintenance'
import ContentUnavailable from '../../_deck/unavailable'
import { recordDeckView } from '@/lib/deck-views'
import { databaseReachable, rebuildHold } from '@/lib/db-health'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const report = await getReportBySlug(slug)
  if (!report) {
    // Outage, not absence: the link preview must not say "not found" while the
    // database is down — clients re-share these links. Same rule as /c.
    if (rebuildHold() || !(await databaseReachable())) {
      return { title: 'הדוח בעדכון | Results Digital', robots: { index: false, follow: false } }
    }
    return { title: 'הדף לא נמצא | Results Digital', robots: { index: false, follow: false } }
  }

  const shareImage = { url: '/og-image.png', width: 1200, height: 630, alt: 'Results Digital' }
  const isScheduled = report.publish_at && new Date(report.publish_at) > new Date()
  if (report.status === 'draft' || report.password || isScheduled) {
    return {
      title: 'Results Digital',
      robots: { index: false, follow: false },
      openGraph: { title: 'Results Digital', images: [shareImage] },
      twitter: { card: 'summary_large_image', title: 'Results Digital', images: [shareImage.url] },
    }
  }

  const title = `${report.client} – ${report.report_name}`
  const description = `דוח ביצועים עבור ${report.client}`
  return {
    title: `${title} | Results Digital`,
    description,
    // Performance reports carry client budgets and ROI. Even a published,
    // unprotected report is meant for the recipient of the link only, never
    // for search indexes — the slug is not a secret.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'Results Digital', images: [shareImage] },
    twitter: { card: 'summary_large_image', title, description, images: [shareImage.url] },
  }
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  const report = await getReportBySlug(slug)

  if (!report) {
    // Outage, not absence: clients hold these links. See app/c/[slug]/page.tsx.
    if (rebuildHold() || !(await databaseReachable())) return <MaintenancePage />
    notFound()
  }

  const session = await getSession()
  const isEditorOrAdmin = !!session && (session.role === 'admin' || session.role === 'editor')
  const isPreview = sp.preview === '1' && isEditorOrAdmin

  if (report.status === 'draft' && !isPreview) return <ContentUnavailable variant="not_published" />
  if (report.publish_at && new Date(report.publish_at) > new Date() && !isPreview) return <ContentUnavailable variant="not_published" />

  if (report.password && !isEditorOrAdmin) {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(`rpt_${report.id}`)?.value
    const tokenValid = accessToken ? await verifyAccessToken(accessToken, report.id, report.password) : false
    if (!tokenValid) {
      return <PasswordGate slug={slug} clientName={report.client} />
    }
  }

  // Client view (all gates passed, no staff session) — fire-and-forget.
  if (!session) {
    const hdrs = await headers()
    recordDeckView({
      content_type: 'report',
      content_id: report.id,
      ip: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      user_agent: hdrs.get('user-agent') || undefined,
    }).catch(() => {})
  }

  let brandColor: string | null = report.brand_color
  if (!brandColor && report.client_id) {
    const client = await getClientById(report.client_id)
    if (client?.brand_color) brandColor = client.brand_color
  }

  return (
    <ReportPresentation
      report={{
        client: report.client,
        reportName: report.report_name,
        periodLabel: report.period_label || '',
        tabs: report.tabs,
        tabsEn: report.tabs_en || null,
      }}
      brandColor={brandColor}
    />
  )
}
