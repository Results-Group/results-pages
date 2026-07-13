'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, UserPlus, Shield, Pencil, Trash2, X, Check, Building, Star, ChevronDown, ChevronUp } from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n'

interface WorkspaceMembership {
  workspace_id: string
  role: string
  permissions: Record<string, boolean>
  workspaces: {
    id: string
    name: string
    slug: string
    color: string
    icon: string
  }
}

interface AdminUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  is_owner: boolean
  created_at: string
  last_login: string | null
  workspace_memberships: WorkspaceMembership[]
}

interface Workspace {
  id: string
  name: string
  slug: string
  color: string
}

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  admin: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  editor: { color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.1)' },
  viewer: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
}

async function fetchIsOwnerOrAdmin(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return false
    const { user } = await res.json()
    return !!user?.isOwner || user?.role === 'admin'
  } catch {
    return false
  }
}

export default function UsersPage() {
  const t = useT()
  const locale = useLocale()

  const ROLE_LABELS: Record<string, string> = {
    admin: t('role.admin'),
    editor: t('role.editor'),
    viewer: t('role.viewer'),
  }

  const PERMISSION_LABELS: Record<string, string> = {
    can_upload: t('users.permUpload'),
    can_edit: t('users.permEdit'),
    can_delete: t('users.permDelete'),
    can_manage_users: t('users.permManageUsers'),
  }

  const [users, setUsers] = useState<AdminUser[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [currentIsOwnerOrAdmin, setCurrentIsOwnerOrAdmin] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<string>('editor')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  useEffect(() => {
    fetchIsOwnerOrAdmin().then(v => setCurrentIsOwnerOrAdmin(v))
    fetchUsers()
    fetchWorkspaces()
  }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (res.ok) {
        setUsers(await res.json())
      } else if (res.status === 403) {
        setError(t('users.noPermission'))
      } else {
        setError(t('users.loadError'))
      }
    } catch {
      setError(t('users.loadError'))
    } finally {
      setLoading(false)
    }
  }, [])

  async function fetchWorkspaces() {
    const res = await fetch('/api/workspaces')
    if (res.ok) setWorkspaces(await res.json())
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError('')

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
      })
      if (res.ok) {
        setShowAddForm(false)
        setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('editor')
        showSuccess(t('users.userCreated'))
        fetchUsers()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t('users.createError'))
      }
    } catch {
      setError(t('users.createError'))
    } finally {
      setAdding(false)
    }
  }

  function startEdit(user: AdminUser) {
    setEditingId(user.id)
    setEditName(user.name)
    setEditRole(user.role)
    setEditPassword('')
  }

  async function handleSaveEdit() {
    if (!editingId) return
    setSaving(true)
    setError('')

    const body: Record<string, unknown> = { id: editingId }
    if (editName) body.name = editName
    if (editRole) body.role = editRole
    if (editPassword) body.password = editPassword

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setEditingId(null)
        showSuccess(t('users.userUpdated'))
        fetchUsers()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t('users.updateError'))
      }
    } catch {
      setError(t('users.updateError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(locale === 'en' ? `Delete user "${name}"?` : `למחוק את המשתמש "${name}"?`)) return
    setError('')
    const res = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      showSuccess(t('users.userDeleted'))
      fetchUsers()
    } else {
      const data = await res.json()
      setError(data.error || t('users.deleteError'))
    }
  }

  async function assignWorkspace(userId: string, workspaceId: string, role: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })
    if (res.ok) {
      showSuccess(t('users.assignedToWorkspace'))
      fetchUsers()
    }
  }

  async function updateMemberRole(userId: string, workspaceId: string, role: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })
    if (res.ok) fetchUsers()
  }

  async function updateMemberPermission(userId: string, workspaceId: string, currentPerms: Record<string, boolean>, key: string, value: boolean) {
    const permissions = { ...currentPerms, [key]: value }
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, permissions }),
    })
    if (res.ok) fetchUsers()
  }

  async function removeMember(userId: string, workspaceId: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    if (res.ok) {
      showSuccess(t('users.removedFromWorkspace'))
      fetchUsers()
    }
  }

  const inputStyle = {
    background: 'var(--admin-bg-elevated)',
    border: '1px solid var(--admin-border)',
    color: 'var(--admin-text-primary)',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6" style={{ color: 'var(--admin-accent)' }} />
          <h2 className="text-xl font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{t('users.title')}</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showAddForm ? t('common.cancel') : t('users.addUser')}
        </button>
      </div>

      {successMsg && (
        <div
          className="mb-6 p-4 rounded-xl flex items-center gap-2.5 text-sm font-medium"
          style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#22c55e' }}
        >
          <Check className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {error && (
        <div
          className="mb-6 p-4 rounded-lg text-sm font-medium"
          style={{ background: 'var(--admin-danger-bg)', border: '1px solid var(--admin-danger-border)', color: 'var(--admin-danger)' }}
        >
          {error}
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mb-6 p-6 rounded-xl space-y-4"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
        >
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--admin-text-primary)' }}>
            <UserPlus className="w-4.5 h-4.5 inline-block ml-2" style={{ verticalAlign: '-2px' }} />
            {t('users.newUser')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('common.name')}</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required placeholder={t('users.namePlaceholder')} className="w-full px-4 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('common.email')}</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="user@results.co.il" dir="ltr" className="w-full px-4 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('users.passwordLabel')}</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} autoComplete="new-password" placeholder={t('users.passwordPlaceholder')} dir="ltr" className="w-full px-4 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>{t('users.roleLabel')}</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full px-4 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="editor">{t('role.editor')}</option>
                <option value="viewer">{t('role.viewer')}</option>
                <option value="admin">{t('role.admin')}</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={adding} className="px-6 py-3 rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}>
            {adding ? t('users.creating') : t('users.createUser')}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{t('common.loading')}</p>
      ) : users.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--admin-text-muted)' }}>
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium mb-1">{t('users.noUsers')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(user => {
            const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.viewer
            const isEditing = editingId === user.id
            const isExpanded = expandedUser === user.id
            const userWorkspaceIds = new Set(user.workspace_memberships?.map(m => m.workspace_id) || [])
            const unassignedWorkspaces = workspaces.filter(ws => !userWorkspaceIds.has(ws.id))

            return (
              <div
                key={user.id}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
              >
                {/* User row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isEditing ? (
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm outline-none max-w-[180px]" style={inputStyle} />
                      ) : (
                        <span className="font-medium text-sm" style={{ color: 'var(--admin-text-primary)' }}>{user.name}</span>
                      )}
                      {user.is_owner && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-medium flex items-center gap-1" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.15)' }}>
                          <Star className="w-3 h-3" /> {t('layout.owner')}
                        </span>
                      )}
                      {isEditing ? (
                        <select value={editRole} onChange={e => setEditRole(e.target.value)} className="px-3 py-1.5 rounded-lg text-xs outline-none" style={inputStyle}>
                          <option value="admin">{t('role.admin')}</option>
                          <option value="editor">{t('role.editor')}</option>
                          <option value="viewer">{t('role.viewer')}</option>
                        </select>
                      ) : (
                        <span className="text-xs px-2.5 py-0.5 rounded-md font-medium" style={{ color: roleStyle.color, background: roleStyle.bg }}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1" dir="ltr" style={{ color: 'var(--admin-text-muted)' }}>
                      {user.email}
                      {user.last_login && (
                        <span className="mr-3">
                          · {t('users.lastLogin')} {new Date(user.last_login).toLocaleString(locale === 'en' ? 'en-US' : 'he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </p>
                    {user.workspace_memberships?.length > 0 && !isExpanded && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {user.workspace_memberships.map(m => (
                          <span key={m.workspace_id} className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: (m.workspaces?.color || '#888') + '22', color: m.workspaces?.color || '#888' }}>
                            {m.workspaces?.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isEditing ? (
                      <>
                        <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} autoComplete="new-password" placeholder={t('users.newPassword')} dir="ltr" className="px-3 py-1.5 rounded-lg text-xs outline-none w-[130px]" style={inputStyle} />
                        <button onClick={handleSaveEdit} disabled={saving} className="p-1.5 rounded-lg" style={{ color: 'var(--admin-success)' }} title={t('common.save')}><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--admin-text-muted)' }} title={t('common.cancel')}><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setExpandedUser(isExpanded ? null : user.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--admin-text-muted)' }} title={t('nav.workspaces')}>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button onClick={() => startEdit(user)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--admin-link)' }} title={t('common.edit')}><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(user.id, user.name)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--admin-danger)' }} title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded workspace panel */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1" style={{ borderTop: '1px solid var(--admin-border)' }}>
                    <p className="text-xs font-medium mb-3 mt-3" style={{ color: 'var(--admin-text-secondary)' }}>
                      <Building className="w-3.5 h-3.5 inline-block ml-1" style={{ verticalAlign: '-2px' }} />
                      {t('users.workspacesPermissions')}
                    </p>

                    {user.workspace_memberships?.length > 0 ? (
                      <div className="space-y-3 mb-4">
                        {user.workspace_memberships.map(m => (
                          <div key={m.workspace_id} className="p-3 rounded-xl" style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-4 h-4 rounded-full" style={{ background: m.workspaces?.color || '#888' }} />
                              <span className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>{m.workspaces?.name}</span>
                              <select
                                value={m.role}
                                onChange={e => updateMemberRole(user.id, m.workspace_id, e.target.value)}
                                className="px-2 py-0.5 rounded-lg text-xs outline-none mr-auto"
                                style={inputStyle}
                              >
                                <option value="admin">{t('role.admin')}</option>
                                <option value="editor">{t('role.editor')}</option>
                                <option value="viewer">{t('role.viewer')}</option>
                              </select>
                              <button
                                onClick={() => removeMember(user.id, m.workspace_id)}
                                className="p-1 rounded-lg text-xs"
                                style={{ color: 'var(--admin-danger)' }}
                                title={t('users.removeFromWorkspace')}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {Object.entries(PERMISSION_LABELS)
                              .filter(([key]) => !(key === 'can_manage_users' && m.role !== 'admin'))
                              .map(([key, label]) => {
                                const isOn = key in (m.permissions || {})
                                  ? m.permissions[key]
                                  : undefined
                                return (
                                  <button
                                    key={key}
                                    onClick={() => updateMemberPermission(user.id, m.workspace_id, m.permissions || {}, key, isOn === undefined ? true : !isOn)}
                                    className="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors"
                                    style={{
                                      background: isOn === true
                                        ? 'rgba(34,197,94,0.15)'
                                        : isOn === false
                                          ? 'rgba(239,68,68,0.12)'
                                          : 'var(--admin-bg-elevated)',
                                      color: isOn === true
                                        ? '#22c55e'
                                        : isOn === false
                                          ? '#ef4444'
                                          : 'var(--admin-text-muted)',
                                      border: '1px solid ' + (isOn === true
                                        ? 'rgba(34,197,94,0.25)'
                                        : isOn === false
                                          ? 'rgba(239,68,68,0.25)'
                                          : 'var(--admin-border)'),
                                    }}
                                    title={isOn === undefined ? 'ברירת מחדל (לפי תפקיד)' : isOn ? 'מופעל (לחץ לכיבוי)' : 'מכובה (לחץ להפעלה)'}
                                  >
                                    {label}
                                    {isOn === undefined && ' ⊘'}
                                    {isOn === true && ' ✓'}
                                    {isOn === false && ' ✕'}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs mb-3" style={{ color: 'var(--admin-text-muted)' }}>{t('users.notAssigned')}</p>
                    )}

                    {/* Add to workspace */}
                    {unassignedWorkspaces.length > 0 && currentIsOwnerOrAdmin && (
                      <div className="flex items-center gap-2">
                        <select
                          id={`assign-ws-${user.id}`}
                          className="px-3 py-1.5 rounded-lg text-xs outline-none flex-1"
                          style={inputStyle}
                          defaultValue=""
                        >
                          <option value="" disabled>{t('users.addToWorkspace')}</option>
                          {unassignedWorkspaces.map(ws => (
                            <option key={ws.id} value={ws.id}>{ws.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const select = document.getElementById(`assign-ws-${user.id}`) as HTMLSelectElement
                            if (select?.value) assignWorkspace(user.id, select.value, 'editor')
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
                        >
                          {t('common.add')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
