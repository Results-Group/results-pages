'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FileText,
  Upload,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Users,
  Shield,
  Megaphone,
  Building,
  ChevronDown,
  Check,
  Contact,
  BarChart3,
  Trash2,
  ScrollText,
} from 'lucide-react'

interface SessionUser {
  userId: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  name: string
  isOwner?: boolean
}

interface Workspace {
  id: string
  name: string
  slug: string
  color: string
  icon: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'אדמין',
  editor: 'עורך',
  viewer: 'צופה',
}

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  admin: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  editor: { color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.12)' },
  viewer: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' },
}

async function fetchCurrentUser(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return null
    const { user } = await res.json()
    return user || null
  } catch {
    return null
  }
}

function setWorkspaceCookie(workspaceId: string) {
  document.cookie = `rp_workspace=${encodeURIComponent(workspaceId)};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
}

function getActiveWorkspaceFromCookie(): string | null {
  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('rp_workspace='))
    if (!cookie) return null
    return decodeURIComponent(cookie.substring('rp_workspace='.length))
  } catch {
    return null
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null)
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false)
  const wsDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved)
    }
    setActiveWorkspace(getActiveWorkspaceFromCookie())
    fetchCurrentUser().then(u => setCurrentUser(u))
  }, [])

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces')
      if (res.ok) {
        const data = await res.json()
        setWorkspaces(data)
        if (!getActiveWorkspaceFromCookie() && data.length > 0) {
          setActiveWorkspace(data[0].id)
          setWorkspaceCookie(data[0].id)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (currentUser) fetchWorkspaces()
  }, [currentUser, fetchWorkspaces])

  const isAdmin = currentUser?.role === 'admin'
  const isOwner = currentUser?.isOwner

  const navItems = [
    { href: '/admin', label: 'כל הדפים', icon: FileText, show: true },
    { href: '/admin/upload', label: 'העלאת דף', icon: Upload, show: currentUser?.role !== 'viewer' },
    { href: '/admin/campaigns', label: 'קמפיינים', icon: Megaphone, show: currentUser?.role !== 'viewer' },
    { href: '/admin/clients', label: 'לקוחות', icon: Contact, show: currentUser?.role !== 'viewer' },
    { href: '/admin/analytics', label: 'אנליטיקס', icon: BarChart3, show: currentUser?.role !== 'viewer' },
    { href: '/admin/users', label: 'משתמשים', icon: Users, show: isAdmin || isOwner },
    { href: '/admin/workspaces', label: 'סביבות עבודה', icon: Building, show: isAdmin || isOwner },
    { href: '/admin/audit', label: 'יומן פעילות', icon: ScrollText, show: isAdmin || isOwner },
    { href: '/admin/trash', label: 'סל מיחזור', icon: Trash2, show: currentUser?.role !== 'viewer' },
  ]

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    document.documentElement.classList.add('theme-transition')
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 350)
  }

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!wsDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target as Node)) {
        setWsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [wsDropdownOpen])

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/admin/login')
  }

  function switchWorkspace(wsId: string) {
    if (wsId === activeWorkspace) {
      setWsDropdownOpen(false)
      return
    }
    setActiveWorkspace(wsId)
    setWorkspaceCookie(wsId)
    setWsDropdownOpen(false)
    window.location.href = pathname || '/admin'
  }

  const activeWs = workspaces.find(w => w.id === activeWorkspace)
  const roleStyle = currentUser ? (ROLE_COLORS[currentUser.role] || ROLE_COLORS.viewer) : null

  const sidebarContent = (
    <>
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Results" className="h-7 w-auto" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--sidebar-text)' }}>Results Pages</h1>
            <p className="text-[11px]" style={{ color: 'var(--sidebar-text-muted)' }}>ניהול דפים</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-md"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {currentUser && currentUser.userId !== 'legacy' && (
          <div className="mb-3 px-2.5 py-2 rounded-lg" style={{ background: 'var(--sidebar-hover-bg)' }}>
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: roleStyle?.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--sidebar-text)' }}>
                  {currentUser.name}
                </p>
                <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>
                  {isOwner ? 'בעלים' : ROLE_LABELS[currentUser.role]}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Workspace switcher */}
        {workspaces.length > 0 && (
          <div className="relative" ref={wsDropdownRef}>
            <button
              type="button"
              onClick={() => setWsDropdownOpen(open => !open)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: 'var(--sidebar-hover-bg)',
                color: 'var(--sidebar-text)',
              }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: activeWs?.color || '#40e1d3' }}
              />
              <span className="flex-1 text-right truncate">{activeWs?.name || 'בחר סביבת עבודה'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${wsDropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--sidebar-text-muted)' }} />
            </button>

            {wsDropdownOpen && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded-lg py-1 z-[60] shadow-lg"
                style={{
                  background: 'var(--admin-bg-elevated)',
                  border: '1px solid var(--sidebar-border)',
                }}
              >
                {workspaces.map(ws => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => switchWorkspace(ws.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors"
                    style={{
                      color: ws.id === activeWorkspace ? 'var(--sidebar-accent)' : 'var(--sidebar-text-secondary)',
                      background: ws.id === activeWorkspace ? 'var(--sidebar-active-bg)' : 'transparent',
                    }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ws.color }} />
                    <span className="flex-1 text-right truncate">{ws.name}</span>
                    {ws.id === activeWorkspace && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mx-4 mb-2 h-px" style={{ background: 'var(--sidebar-border)' }} />

      <nav className="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto">
        {navItems.filter(item => item.show).map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors"
              style={active
                ? { color: 'var(--sidebar-accent)', background: 'var(--sidebar-active-bg)' }
                : { color: 'var(--sidebar-text-secondary)' }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--sidebar-hover-bg)'
                  e.currentTarget.style.color = 'var(--sidebar-text)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--sidebar-text-secondary)'
                }
              }}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-2.5 space-y-0.5" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors w-full"
          style={{ color: 'var(--sidebar-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--sidebar-hover-bg)'
            e.currentTarget.style.color = 'var(--sidebar-text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--sidebar-text-secondary)'
          }}
          title={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors w-full"
          style={{ color: 'var(--sidebar-text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--admin-danger-bg)'
            e.currentTarget.style.color = 'var(--admin-danger)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--sidebar-text-muted)'
          }}
        >
          <LogOut className="w-4 h-4" />
          התנתקות
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-50 p-3 rounded-xl shadow-lg"
        style={{ background: 'var(--sidebar-bg)', border: '1px solid var(--sidebar-border)', color: 'var(--sidebar-text)' }}
        aria-label="פתח תפריט"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-56 flex flex-col flex-shrink-0 transition-all duration-300 max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:shadow-2xl ${mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full'} lg:relative lg:translate-x-0`}
        style={{ background: 'var(--sidebar-bg)', borderLeft: '1px solid var(--sidebar-border)' }}
      >
        {sidebarContent}
      </aside>

      {/* Content */}
      <main className="flex-1 p-4 pt-14 sm:p-5 sm:pt-14 lg:p-7 lg:pt-7 overflow-auto admin-content min-w-0">
        {children}
      </main>
    </div>
  )
}
