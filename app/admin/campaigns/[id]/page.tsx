'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import CampaignBuilder, { type BuilderInitial, type Section, type Asset } from '../_components/campaign-builder'

export default function EditCampaignPage() {
  const params = useParams()
  const campaignId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [initial, setInitial] = useState<BuilderInitial | null>(null)

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}`)
      .then(r => {
        if (r.status === 401) {
          window.location.href = '/admin/login'
          return null
        }
        if (!r.ok) throw new Error('load failed')
        return r.json()
      })
      .then(data => {
        if (!data) return
        const rawSections = typeof data.sections === 'string' ? JSON.parse(data.sections) : (data.sections || [])
        const sections: Section[] = rawSections.map((s: Section) => ({
          id: s.id || crypto.randomUUID(),
          title: s.title || '',
          mockup_type: s.mockup_type || 'general',
          description: s.description || '',
          assets: (s.assets || []).map((a: Asset) => ({
            id: a.id || crypto.randomUUID(),
            type: a.type || 'image',
            file_path: a.file_path || '',
            public_url: a.public_url || '',
            url: a.url || '',
            caption: a.caption || '',
          })),
        }))
        setInitial({
          campaignId,
          client: data.client || '',
          campaignName: data.campaign_name || '',
          concept: data.concept || '',
          password: data.password || '',
          logoPath: data.logo_path || null,
          logoUrl: data.logo_url || null,
          slug: data.slug || null,
          status: data.status || 'draft',
          sections,
        })
        setLoading(false)
      })
      .catch(() => {
        setError('שגיאה בטעינת הקמפיין')
        setLoading(false)
      })
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

  return <CampaignBuilder mode="edit" initial={initial} />
}
