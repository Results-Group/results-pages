'use client'

import { useState, useEffect } from 'react'
import { Building } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  slug: string
  color: string
}

interface WorkspaceSelectorProps {
  value: string | null
  onChange: (workspaceId: string) => void
}

export default function WorkspaceSelector({ value, onChange }: WorkspaceSelectorProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => r.ok ? r.json() : [])
      .then((data: Workspace[]) => { setWorkspaces(data); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded || workspaces.length === 0) return null

  return (
    <div>
      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>
        <Building className="w-3.5 h-3.5 inline-block ml-1.5" style={{ verticalAlign: '-2px' }} />
        סביבת עבודה
      </label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
        style={{
          background: 'var(--admin-bg-elevated)',
          border: '1px solid var(--admin-border)',
          color: 'var(--admin-text-primary)',
        }}
      >
        <option value="">ללא סביבת עבודה</option>
        {workspaces.map(ws => (
          <option key={ws.id} value={ws.id}>{ws.name}</option>
        ))}
      </select>
    </div>
  )
}
