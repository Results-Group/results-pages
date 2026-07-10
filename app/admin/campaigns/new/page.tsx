'use client'

import { useEffect, useState } from 'react'
import CampaignEditor, { type EditorInitial } from '../_components/editor/CampaignEditor'
import type { CampaignDocument } from '../_components/editor/types'
import { newSection } from '../_components/editor/types'

function getActiveWorkspace(): string | null {
  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('rp_workspace='))
    return cookie ? decodeURIComponent(cookie.substring('rp_workspace='.length)) : null
  } catch { return null }
}

export default function NewCampaignPage() {
  const [initial, setInitial] = useState<EditorInitial | null>(null)

  useEffect(() => {
    const doc: CampaignDocument = {
      meta: {
        client: '',
        clientId: null,
        campaignName: '',
        concept: '',
        password: '',
        hasPassword: false,
        logoPath: null,
        logoUrl: null,
        workspaceId: getActiveWorkspace(),
        publishAt: null,
      },
      sections: [newSection()],
    }
    setInitial({ doc, status: 'draft' })
  }, [])

  if (!initial) return null
  return <CampaignEditor mode="new" initial={initial} />
}
