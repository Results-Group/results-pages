import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireWorkspacePermission } from '@/lib/auth'
import {
  getCampaignById, createCampaign, updateCampaign, copyAsset, deleteCampaignAssets,
  type CampaignSection,
} from '@/lib/campaigns'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

/**
 * The DB UNIQUE constraint on slug includes soft-deleted rows, so check
 * existence directly without filtering out deleted campaigns.
 */
async function slugExists(slug: string): Promise<boolean> {
  const { data } = await supabase.from('campaigns').select('id').eq('slug', slug).limit(1)
  return (data?.length ?? 0) > 0
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'viewer' && !session.isOwner) {
    return NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 })
  }

  const { id } = await params
  const source = await getCampaignById(id)
  if (!source || source.deleted_at) return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })

  if (source.workspace_id) {
    const permErr = await requireWorkspacePermission(req, source.workspace_id, 'create')
    if (permErr) return permErr
  }

  try {
    // Parse the source sections BEFORE creating the draft so a parse error
    // can't leave an orphaned empty campaign behind
    const sourceSections = (typeof source.sections === 'string'
      ? JSON.parse(source.sections)
      : source.sections || []) as CampaignSection[]

    // Unique slug: reuse the base name with a fresh suffix
    const base = source.slug.replace(/-[a-z0-9]{6}$/, '')
    let slug = `${base}-${crypto.randomUUID().slice(0, 6)}`
    while (await slugExists(slug)) {
      slug = `${base}-${crypto.randomUUID().slice(0, 6)}`
    }

    // Create the new campaign first (draft) so we have its id for asset paths
    const duplicate = await createCampaign({
      client: source.client,
      campaign_name: `${source.campaign_name} (עותק)`,
      slug,
      concept: source.concept || undefined,
      sections: [],
      status: 'draft',
      created_by: session.userId,
      workspace_id: source.workspace_id || undefined,
      client_id: source.client_id,
    })

    try {
      // Copy assets into the new campaign's storage folder and rewrite paths
      const oldPrefix = `campaigns/${source.id}/`
      const newPrefix = `campaigns/${duplicate.id}/`

      const newSections: CampaignSection[] = []
      for (const section of sourceSections) {
        const assets = []
        for (const asset of section.assets || []) {
          if (asset.file_path && asset.file_path.startsWith(oldPrefix)) {
            const newPath = asset.file_path.replace(oldPrefix, newPrefix)
            try {
              await copyAsset(asset.file_path, newPath)
              assets.push({ ...asset, file_path: newPath, public_url: undefined })
            } catch (copyErr) {
              // Drop the asset — keeping the source path would break once the
              // source campaign is purged
              captureException(copyErr, {
                route: 'POST /api/campaigns/[id]/duplicate', id, step: 'copyAsset', asset: asset.file_path,
              })
            }
          } else {
            assets.push({ ...asset })
          }
        }
        newSections.push({ ...section, assets })
      }

      // Copy logo if it belonged to the source campaign
      let newLogoPath: string | null = null
      if (source.logo_path && source.logo_path.startsWith(oldPrefix)) {
        const target = source.logo_path.replace(oldPrefix, newPrefix)
        try {
          newLogoPath = await copyAsset(source.logo_path, target)
        } catch (copyErr) {
          captureException(copyErr, {
            route: 'POST /api/campaigns/[id]/duplicate', id, step: 'copyAsset', asset: source.logo_path,
          })
          newLogoPath = null
        }
      }

      const finalCampaign = await updateCampaign(duplicate.id, {
        sections: newSections,
        ...(newLogoPath ? { logo_path: newLogoPath } : {}),
      })

      await logAudit({ actor: session, action: 'create', entity_type: 'campaign', entity_id: finalCampaign.id, entity_label: finalCampaign.campaign_name, workspace_id: finalCampaign.workspace_id })
      return NextResponse.json(finalCampaign, { status: 201 })
    } catch (err) {
      // Best-effort rollback so a failure doesn't leave an orphaned draft
      try {
        await deleteCampaignAssets(duplicate.id)
        await supabase.from('campaigns').delete().eq('id', duplicate.id)
      } catch { /* rollback is best-effort */ }
      throw err
    }
  } catch (err) {
    captureException(err, { route: 'POST /api/campaigns/[id]/duplicate', id })
    return NextResponse.json({ error: 'שגיאה בשכפול הקמפיין' }, { status: 500 })
  }
}
