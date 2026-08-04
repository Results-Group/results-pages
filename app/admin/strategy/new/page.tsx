'use client'

import { useEffect, useState } from 'react'
import StrategyEditor from '../_components/editor/StrategyEditor'
import { createBrandPositioningTemplate } from '@/lib/strategy/template'
import type { StrategyDocument } from '@/lib/strategy/types'

/**
 * A new document opens with the whole brand-positioning template already laid
 * out — titles, fixed copy and empty structure — and the operator edits,
 * reorders or deletes from there.
 */
export default function NewStrategyDocPage() {
  const [doc, setDoc] = useState<StrategyDocument | null>(null)

  useEffect(() => {
    // Built client-side: the template calls crypto.randomUUID per section, so
    // generating it during render would produce different ids on server and
    // client and fail hydration.
    const workspaceId = document.cookie.split('; ').find(c => c.startsWith('rp_workspace='))?.split('=')[1] ?? null
    setDoc({
      meta: { client: '', clientId: null, docName: 'מצגת מיצוב', logoPath: null, logoUrl: null, workspaceId },
      sections: createBrandPositioningTemplate(),
    })
  }, [])

  if (!doc) return null

  return <StrategyEditor initial={{ id: null, updatedAt: null, slug: null, status: 'draft', doc }} />
}
