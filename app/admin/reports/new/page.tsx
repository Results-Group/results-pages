'use client'

import ReportEditor from '../_components/ReportEditor'
import type { ReportEditorInitial } from '../_components/ReportEditor'

function getActiveWorkspace(): string | null {
  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('rp_workspace='))
    return cookie ? decodeURIComponent(cookie.substring('rp_workspace='.length)) : null
  } catch { return null }
}

export default function NewReportPage() {
  const initial: ReportEditorInitial = {
    report: {
      client: '',
      client_id: null,
      report_name: '',
      period_label: '',
      tabs: [],
      workspace_id: getActiveWorkspace(),
    },
    status: 'draft',
  }

  return <ReportEditor mode="new" initial={initial} />
}
