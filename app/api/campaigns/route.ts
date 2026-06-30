import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole, getSessionFromRequest } from '@/lib/auth'
import { getCampaigns, getCampaignBySlug, createCampaign } from '@/lib/campaigns'

export async function GET(request: NextRequest) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || undefined
  const status = searchParams.get('status') || undefined

  try {
    const campaigns = await getCampaigns({ search, status })
    return NextResponse.json(campaigns)
  } catch (error) {
    return NextResponse.json(
      { error: 'שגיאה בטעינת קמפיינים' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const roleErr = requireRole(request, 'editor')
  if (roleErr) return roleErr

  const session = getSessionFromRequest(request)

  try {
    const body = await request.json()
    const { client, campaign_name, concept, status, password, sections, logo_path } = body

    if (!client || !campaign_name) {
      return NextResponse.json(
        { error: 'שם לקוח ושם קמפיין הם שדות חובה' },
        { status: 400 }
      )
    }

    const baseSlug = (body.slug || campaign_name)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    const suffix = crypto.randomUUID().slice(0, 6)
    const slug = baseSlug ? `${baseSlug}-${suffix}` : suffix

    const existing = await getCampaignBySlug(slug)
    if (existing) {
      return NextResponse.json(
        { error: `קמפיין עם הסלאג "${slug}" כבר קיים` },
        { status: 409 }
      )
    }

    const campaign = await createCampaign({
      client,
      campaign_name,
      slug,
      concept: concept || undefined,
      logo_path: logo_path || undefined,
      sections: sections || undefined,
      status: status || 'draft',
      password: password || undefined,
      created_by: session?.userId !== 'legacy' ? session?.userId : undefined,
    })

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'שגיאה ביצירת קמפיין' },
      { status: 500 }
    )
  }
}
