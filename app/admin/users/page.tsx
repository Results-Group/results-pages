'use client'

import { useEffect, useState } from 'react'
import { Users, UserPlus, Shield, Pencil, Trash2, X, Check, KeyRound } from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  created_at: string
  last_login: string | null
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'אדמין',
  editor: 'עורך',
  viewer: 'צופה',
}

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  admin: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  editor: { color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.1)' },
  viewer: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // New user form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<string>('editor')
  const [adding, setAdding] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const res = await fetch('/api/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data)
    } else if (res.status === 403) {
      setError('אין הרשאה לצפות במשתמשים')
    } else {
      setError('שגיאה בטעינת משתמשים')
    }
    setLoading(false)
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError('')

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
    })

    if (res.ok) {
      setShowAddForm(false)
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      setNewRole('editor')
      showSuccess('משתמש נוצר בהצלחה!')
      fetchUsers()
    } else {
      const data = await res.json()
      setError(data.error || 'שגיאה ביצירת משתמש')
    }
    setAdding(false)
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

    const body: Record<string, string> = { id: editingId }
    if (editName) body.name = editName
    if (editRole) body.role = editRole
    if (editPassword) body.password = editPassword

    const res = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setEditingId(null)
      showSuccess('משתמש עודכן בהצלחה!')
      fetchUsers()
    } else {
      const data = await res.json()
      setError(data.error || 'שגיאה בעדכון משתמש')
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את המשתמש "${name}"?`)) return
    setError('')

    const res = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })

    if (res.ok) {
      showSuccess('משתמש נמחק בהצלחה!')
      fetchUsers()
    } else {
      const data = await res.json()
      setError(data.error || 'שגיאה במחיקת משתמש')
    }
  }

  const inputStyle = {
    background: 'var(--admin-bg-elevated)',
    border: '1px solid var(--admin-border)',
    color: 'var(--admin-text-primary)',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6" style={{ color: 'var(--admin-accent)' }} />
          <h2 className="text-2xl font-black" style={{ color: 'var(--admin-text-primary)' }}>משתמשים</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px var(--admin-accent-glow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showAddForm ? 'ביטול' : 'הוספת משתמש'}
        </button>
      </div>

      {successMsg && (
        <div
          className="mb-6 p-4 rounded-xl flex items-center gap-2.5 text-sm font-bold"
          style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#22c55e' }}
        >
          <Check className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {error && (
        <div
          className="mb-6 p-4 rounded-xl text-sm font-bold"
          style={{ background: 'var(--admin-danger-bg)', border: '1px solid var(--admin-danger-border)', color: 'var(--admin-danger)' }}
        >
          {error}
        </div>
      )}

      {/* Add User Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mb-8 p-6 rounded-2xl space-y-4"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
        >
          <h3 className="text-base font-black mb-4" style={{ color: 'var(--admin-text-primary)' }}>
            <UserPlus className="w-4.5 h-4.5 inline-block ml-2" style={{ verticalAlign: '-2px' }} />
            משתמש חדש
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>שם</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
                placeholder="ישראל ישראלי"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>אימייל</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                placeholder="user@results.co.il"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>סיסמה</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="לפחות 6 תווים"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--admin-text-secondary)' }}>תפקיד</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                style={inputStyle}
              >
                <option value="editor">עורך</option>
                <option value="viewer">צופה</option>
                <option value="admin">אדמין</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={adding}
            className="px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
            style={{ background: 'var(--admin-accent)', color: 'var(--admin-accent-text)' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 25px var(--admin-accent-glow)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
          >
            {adding ? 'יוצר...' : 'יצירת משתמש'}
          </button>
        </form>
      )}

      {/* Users Table */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>טוען...</p>
      ) : users.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--admin-text-muted)' }}>
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-bold mb-1">אין משתמשים</p>
          <p className="text-sm">יש להריץ את נקודת הקצה /api/setup ליצירת אדמין ראשון</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--admin-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--admin-bg-elevated)', borderBottom: '1px solid var(--admin-border)' }}>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>שם</th>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>אימייל</th>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>תפקיד</th>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>כניסה אחרונה</th>
                <th className="text-start px-5 py-3.5 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.viewer
                const isEditing = editingId === user.id

                return (
                  <tr
                    key={user.id}
                    className="transition-colors duration-150"
                    style={{ borderBottom: '1px solid var(--admin-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="px-3 py-1.5 rounded-lg text-sm outline-none w-full max-w-[180px]"
                          style={inputStyle}
                          onFocus={e => e.currentTarget.style.borderColor = 'var(--admin-accent)'}
                          onBlur={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
                        />
                      ) : (
                        <span className="font-bold" style={{ color: 'var(--admin-text-primary)' }}>{user.name}</span>
                      )}
                    </td>
                    <td className="px-5 py-4" dir="ltr" style={{ color: 'var(--admin-text-secondary)' }}>{user.email}</td>
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={e => setEditRole(e.target.value)}
                          className="px-3 py-1.5 rounded-lg text-sm outline-none"
                          style={inputStyle}
                        >
                          <option value="admin">אדמין</option>
                          <option value="editor">עורך</option>
                          <option value="viewer">צופה</option>
                        </select>
                      ) : (
                        <span
                          className="text-xs px-3 py-1 rounded-full font-bold"
                          style={{ color: roleStyle.color, background: roleStyle.bg }}
                        >
                          {ROLE_LABELS[user.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4" style={{ color: 'var(--admin-text-muted)' }}>
                      {user.last_login
                        ? new Date(user.last_login).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : 'לא התחבר'}
                    </td>
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            value={editPassword}
                            onChange={e => setEditPassword(e.target.value)}
                            placeholder="סיסמה חדשה (אופציונלי)"
                            dir="ltr"
                            className="px-3 py-1.5 rounded-lg text-xs outline-none w-[160px]"
                            style={inputStyle}
                          />
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--admin-success)' }}
                            title="שמירה"
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-success-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--admin-text-muted)' }}
                            title="ביטול"
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(user)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--admin-link)' }}
                            title="עריכה"
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-hover-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.name)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--admin-danger)' }}
                            title="מחיקה"
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-danger-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
