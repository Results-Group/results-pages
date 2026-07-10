'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Users, X, Save, Building } from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n'

interface Workspace {
  id: string
  name: string
  slug: string
  color: string
  icon: string
  created_at: string
}

const WORKSPACE_COLORS = [
  '#40e1d3', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#ec4899', '#3b82f6', '#f97316',
]

export default function WorkspacesPage() {
  const t = useT()
  const locale = useLocale()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', color: '#40e1d3' })
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchWorkspaces() }, [])

  async function fetchWorkspaces() {
    setLoading(true)
    try {
      const res = await fetch('/api/workspaces')
      if (res.ok) {
        const data = await res.json()
        setWorkspaces(data)
        for (const ws of data) {
          fetch(`/api/workspaces/${ws.id}/members`)
            .then(r => r.json())
            .then(members => setMemberCounts(prev => ({ ...prev, [ws.id]: Array.isArray(members) ? members.length : 0 })))
            .catch(() => {})
        }
      }
    } catch {}
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.name || !form.slug) return
    setSaving(true)
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      setShowCreate(false)
      setForm({ name: '', slug: '', color: '#40e1d3' })
      fetchWorkspaces()
    } else {
      const err = await res.json()
      alert(err.error || t('common.error'))
    }
  }

  async function handleUpdate() {
    if (!editingId || !form.name) return
    setSaving(true)
    const res = await fetch(`/api/workspaces/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, color: form.color }),
    })
    setSaving(false)
    if (res.ok) {
      setEditingId(null)
      setForm({ name: '', slug: '', color: '#40e1d3' })
      fetchWorkspaces()
    }
  }

  async function handleDelete(ws: Workspace) {
    if (!confirm(locale === 'en' ? `Delete workspace "${ws.name}"? ${t('workspaces.deleteConfirm')}` : `למחוק את סביבת העבודה "${ws.name}"? ${t('workspaces.deleteConfirm')}`)) return
    await fetch(`/api/workspaces/${ws.id}`, { method: 'DELETE' })
    fetchWorkspaces()
  }

  function startEdit(ws: Workspace) {
    setEditingId(ws.id)
    setForm({ name: ws.name, slug: ws.slug, color: ws.color })
    setShowCreate(false)
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{t('workspaces.title')}</h2>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); setForm({ name: '', slug: '', color: '#40e1d3' }) }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
        >
          <Plus className="w-4 h-4" />
          {t('workspaces.newWorkspace')}
        </button>
      </div>

      {/* Create / Edit form */}
      {(showCreate || editingId) && (
        <div
          className="mb-6 p-6 rounded-xl"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium" style={{ color: 'var(--admin-text-primary)' }}>
              {editingId ? t('workspaces.editWorkspace') : t('workspaces.createWorkspace')}
            </h3>
            <button
              onClick={() => { setShowCreate(false); setEditingId(null) }}
              className="p-1 rounded-lg"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('workspaces.nameLabel')}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => {
                  const name = e.target.value
                  setForm(prev => ({
                    ...prev,
                    name,
                    slug: showCreate ? autoSlug(name) : prev.slug,
                  }))
                }}
                className="w-full px-3.5 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
                placeholder={t('workspaces.namePlaceholder')}
              />
            </div>
            {showCreate && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('workspaces.slugLabel')}</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-lg text-sm outline-none"
                  dir="ltr"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
                  placeholder="workspace-slug"
                />
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--admin-text-secondary)' }}>{t('workspaces.colorLabel')}</label>
            <div className="flex gap-2">
              {WORKSPACE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(prev => ({ ...prev, color: c }))}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c,
                    outline: form.color === c ? '3px solid var(--admin-text-primary)' : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={editingId ? handleUpdate : handleCreate}
            disabled={saving || !form.name || (showCreate && !form.slug)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          >
            <Save className="w-4 h-4" />
            {saving ? t('workspaces.saving') : editingId ? t('workspaces.saveChanges') : t('workspaces.create')}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{t('common.loading')}</p>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--admin-text-muted)' }}>
          <Building className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">{t('workspaces.noWorkspaces')}</p>
          <p className="text-sm">{t('workspaces.noWorkspacesHint')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {workspaces.map(ws => (
            <div
              key={ws.id}
              className="flex items-center gap-4 p-4 rounded-xl transition-colors"
              style={{
                background: 'var(--admin-bg-elevated)',
                border: '1px solid var(--admin-border)',
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: ws.color + '22' }}>
                <Building className="w-5 h-5" style={{ color: ws.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>{ws.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>
                  <span dir="ltr">/{ws.slug}</span>
                  <span className="mx-2">·</span>
                  <Users className="w-3 h-3 inline-block" /> {memberCounts[ws.id] ?? '...'} {t('workspaces.members')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(ws)}
                  className="p-2 rounded-xl transition-colors"
                  style={{ color: 'var(--admin-link)' }}
                  title={t('common.edit')}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(ws)}
                  className="p-2 rounded-xl transition-colors"
                  style={{ color: 'var(--admin-danger)' }}
                  title={t('common.delete')}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-danger-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
