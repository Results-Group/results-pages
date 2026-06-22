'use client'

import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-lg font-bold tracking-tight">Results Pages</h1>
          <p className="text-xs text-gray-400 mt-0.5">ניהול דפים</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink href="/admin">כל הדפים</NavLink>
          <NavLink href="/admin/upload">העלאת דף</NavLink>
        </nav>
        <div className="p-3 border-t border-gray-800">
          <LogoutButton />
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
    >
      {children}
    </Link>
  )
}

function LogoutButton() {
  return (
    <form action="/api/auth" method="dialog">
      <button
        type="submit"
        className="w-full text-start px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        onClick={async (e) => {
          e.preventDefault()
          await fetch('/api/auth', { method: 'DELETE' })
          window.location.href = '/admin/login'
        }}
      >
        התנתקות
      </button>
    </form>
  )
}
