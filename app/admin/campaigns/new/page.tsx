'use client'

import { useEffect, useState } from 'react'
import CampaignEditor, { type EditorInitial } from '../_components/editor/CampaignEditor'
import type { CampaignDocument } from '../_components/editor/types'
import { newSection, sectionFromApi } from '../_components/editor/types'
import { createCampaignLaunchTemplate } from '@/lib/campaign-launch-template'

function getActiveWorkspace(): string | null {
  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('rp_workspace='))
    return cookie ? decodeURIComponent(cookie.substring('rp_workspace='.length)) : null
  } catch { return null }
}

export default function NewCampaignPage() {
  const [initial, setInitial] = useState<EditorInitial | null>(null)

  useEffect(() => {
    // Read via location.search inside the effect (the page is already
    // client-only and builds its state here) — useSearchParams would force a
    // Suspense boundary for no gain.
    const template = new URLSearchParams(window.location.search).get('template')
    // Templates go through sectionFromApi like any loaded campaign, so the
    // template can never carry a field the mapper drops on the next autosave.
    const sections = template === 'launch'
      ? createCampaignLaunchTemplate().map(s => sectionFromApi(s, []))
      : [newSection()]

    const doc: CampaignDocument = {
      meta: {
        client: '',
        clientId: null,
        campaignName: '',
        concept: '',
        copies: [],
        password: '',
        hasPassword: false,
        logoPath: null,
        logoUrl: null,
        workspaceId: getActiveWorkspace(),
        publishAt: null,
        expiresAt: null,
        closingTitle: null,
      },
      sections,
    }
    setInitial({ doc, status: 'draft' })
  }, [])

  if (!initial) return null
  return <CampaignEditor mode="new" initial={initial} />
}
