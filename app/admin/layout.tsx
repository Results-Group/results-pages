'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'

interface SessionUser {
  userId: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  name: string
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

function getSessionFromCookie(): SessionUser | null {
  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('rp_session='))
    if (!cookie) return null
    const value = cookie.split('=')[1]
    const json = atob(decodeURIComponent(value))
    const parsed = JSON.parse(json)
    if (parsed.userId && parsed.role) return parsed as SessionUser
    return null
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

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved)
    }
    setCurrentUser(getSessionFromCookie())
  }, [])

  const isAdmin = currentUser?.role === 'admin'

  const navItems = [
    { href: '/admin', label: 'כל הדפים', icon: FileText, show: true },
    { href: '/admin/upload', label: 'העלאת דף', icon: Upload, show: currentUser?.role !== 'viewer' },
    { href: '/admin/users', label: 'משתמשים', icon: Users, show: isAdmin },
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

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/admin/login')
  }

  const roleStyle = currentUser ? (ROLE_COLORS[currentUser.role] || ROLE_COLORS.viewer) : null

  const sidebarContent = (
    <>
      <div className="p-6 pb-5">
        <div className="flex items-center gap-3 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Results" className="h-10 w-auto" />
          <div className="flex-1">
            <h1 className="text-lg font-black tracking-tight" style={{ color: 'var(--sidebar-text)' }}>Results Pages</h1>
            <p className="text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>ניהול דפים</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 rounded-lg"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current user info */}
        {currentUser && currentUser.userId !== 'legacy' && (
          <div
            className="mt-4 px-4 py-3 rounded-xl"
            style={{ background: 'var(--sidebar-active-bg)', border: '1px solid var(--sidebar-border)' }}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 flex-shrink-0" style={{ color: roleStyle?.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--sidebar-text)' }}>
                  {currentUser.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ color: roleStyle?.color, background: roleStyle?.bg }}
                  >
                    {ROLE_LABELS[currentUser.role]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 mb-4">
        <div className="h-px" style={{ background: 'linear-gradient(to left, transparent, var(--sidebar-border), transparent)' }} />
      </div>

      <nav className="flex-1 px-4 py-3 space-y-1 overflow-y-auto">
        {navItems.filter(item => item.show).map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${active ? 'border-r-3' : ''}`}
              style={active
                ? { color: 'var(--sidebar-accent)', background: 'var(--sidebar-active-bg)', borderColor: 'var(--sidebar-accent-border)' }
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
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 space-y-1" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 w-full"
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
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 w-full"
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
          <LogOut className="w-5 h-5" />
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
        className={`w-72 flex flex-col flex-shrink-0 transition-all duration-300 max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:shadow-2xl ${mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full'} lg:relative lg:translate-x-0`}
        style={{ background: 'var(--sidebar-bg)', borderLeft: '1px solid var(--sidebar-border)' }}
      >
        {sidebarContent}
      </aside>

      {/* Content */}
      <main className="flex-1 p-4 pt-16 sm:p-6 sm:pt-16 lg:p-10 lg:pt-10 overflow-auto admin-content min-w-0">
        {children}
      </main>
    </div>
  )
}
