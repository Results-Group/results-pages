'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import CampaignEditor, { type EditorInitial } from '../_components/editor/CampaignEditor'
import { sectionFromApi } from '../_components/editor/types'
import type { CampaignDocument, EditorSection, Copy } from '../_components/editor/types'

/** Format a UTC ISO string as a LOCAL 'YYYY-MM-DDTHH:mm' value for datetime-local inputs. */
function isoToLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditCampaignPage() {
  const params = useParams()
  const campaignId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [initial, setInitial] = useState<EditorInitial | null>(null)

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}`)
      .then(r => {
        if (r.status === 401) { window.location.href = '/admin/login'; return null }
        if (!r.ok) throw new Error('load failed')
        return r.json()
      })
      .then(data => {
        if (!data) return
        // Normalize copies: legacy string entries become {id,label,body}.
        // We need stable IDs before mapping the legacy useCopies flag onto
        // copyIds below.
        const copies: Copy[] = Array.isArray(data.copies)
          ? data.copies.map((c: unknown) => {
              if (typeof c === 'string') return { id: crypto.randomUUID(), label: '', body: c }
              const obj = (c || {}) as Partial<Copy>
              return { id: obj.id || crypto.randomUUID(), label: obj.label || '', body: obj.body || '' }
            })
          : []
        const allCopyIds = copies.map(c => c.id)

        const rawSections = typeof data.sections === 'string' ? JSON.parse(data.sections) : (data.sections || [])
        const sections: EditorSection[] = rawSections.map(
          (s: Partial<EditorSection> & { useCopies?: boolean }) => sectionFromApi(s, allCopyIds),
        )

        const doc: CampaignDocument = {
          meta: {
            client: data.client || '',
            clientId: data.client_id || null,
            campaignName: data.campaign_name || '',
            concept: data.concept || '',
            copies,
            password: '',
            hasPassword: !!data.has_password,
            logoPath: data.logo_path || null,
            logoUrl: data.logo_url || null,
            workspaceId: data.workspace_id || null,
            publishAt: data.publish_at ? isoToLocalDatetimeInput(data.publish_at) || null : null,
            expiresAt: data.expires_at ? isoToLocalDatetimeInput(data.expires_at) || null : null,
          },
          sections,
        }
        setInitial({ campaignId, doc, slug: data.slug || null, status: data.status || 'draft', updatedAt: data.updated_at || null })
        setLoading(false)
      })
      .catch(() => { setError('שגיאה בטעינת הקמפיין'); setLoading(false) })
  }, [campaignId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--admin-accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (error || !initial) {
    return <p className="text-sm py-10" style={{ color: 'var(--admin-danger)' }}>{error || 'שגיאה בטעינת הקמפיין'}</p>
  }

  return <CampaignEditor mode="edit" initial={initial} />
}
