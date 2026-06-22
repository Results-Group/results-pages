import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Results Pages',
  description: 'Landing pages & reports management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
