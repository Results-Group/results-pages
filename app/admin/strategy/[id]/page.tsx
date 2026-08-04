'use client'

import { useEffect, useState, use } from 'react'
import { Loader2 } from 'lucide-react'
import StrategyEditor, { type StrategyEditorInitial } from '../_components/editor/StrategyEditor'
import { assetProxyUrl } from '@/lib/asset-url'
import { normalizeSections } from '@/lib/strategy/normalize'

export default function EditStrategyDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [initial, setInitial] = useState<StrategyEditorInitial | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/strategy-docs/${id}`)
      .then(res => {
        if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('auth') }
        if (!res.ok) throw new Error('load failed')
        return res.json()
      })
      .then(data => setInitial({
        id: data.id,
        updatedAt: data.updated_at,
        slug: data.slug,
        status: data.status,
        doc: {
          meta: {
            client: data.client ?? '',
            clientId: data.client_id ?? null,
            docName: data.doc_name ?? '',
            logoPath: data.logo_path ?? null,
            logoUrl: data.logo_path ? assetProxyUrl(data.logo_path) : null,
            workspaceId: data.workspace_id ?? null,
          },
          // Normalized again on the client: the editor must never meet a
          // half-written section, whatever the API returned.
          sections: normalizeSections(data.sections),
        },
      }))
      .catch(err => { if (err.message !== 'auth') setError('שגיאה בטעינת המסמך') })
  }, [id])

  if (error) return <p className="text-sm p-6" style={{ color: '#ef4444' }}>{error}</p>
  if (!initial) return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>

  return <StrategyEditor initial={initial} />
}
