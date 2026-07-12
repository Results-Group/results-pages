import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { Metadata } from 'next'
import { getReportBySlug } from '@/lib/performance-reports'
import { getClientById } from '@/lib/clients'
import { getSession } from '@/lib/auth'
import { verifyAccessToken } from '@/lib/content-access'
import ReportPresentation from './report-presentation'
import PasswordGate from './password-gate'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const report = await getReportBySlug(slug)
  if (!report) return { title: 'Report Not Found' }

  if (report.status === 'draft' || report.password) {
    return { title: 'Results Digital', robots: { index: false, follow: false } }
  }

  const title = `${report.client} – ${report.report_name}`
  return {
    title: `${title} | Results Digital`,
    description: `דוח ביצועים עבור ${report.client}`,
    openGraph: { title, type: 'website', siteName: 'Results Digital' },
  }
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  const report = await getReportBySlug(slug)

  if (!report) notFound()

  const session = await getSession()
  const isEditorOrAdmin = !!session && (session.role === 'admin' || session.role === 'editor')
  const isPreview = sp.preview === '1' && isEditorOrAdmin

  if (report.status === 'draft' && !isPreview) notFound()
  if (report.publish_at && new Date(report.publish_at) > new Date() && !isPreview) notFound()

  if (report.password && !isEditorOrAdmin) {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(`rpt_${report.id}`)?.value
    const tokenValid = accessToken ? await verifyAccessToken(accessToken, report.id, report.password) : false
    if (!tokenValid) {
      return <PasswordGate slug={slug} clientName={report.client} />
    }
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
