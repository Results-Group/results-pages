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
} from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'כל הדפים', icon: FileText },
  { href: '/admin/upload', label: 'העלאת דף', icon: Upload },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

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
      </div>

      <div className="px-5 mb-4">
        <div className="h-px" style={{ background: 'linear-gradient(to left, transparent, var(--sidebar-border), transparent)' }} />
      </div>

      <nav className="flex-1 px-4 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${active ? 'border-r-3 border-[#F3D56D]' : ''}`}
              style={active
                ? { color: '#F3D56D', background: 'var(--sidebar-active-bg)' }
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

      <div className="p-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 w-full"
          style={{ color: 'var(--sidebar-text-muted)' }}
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
