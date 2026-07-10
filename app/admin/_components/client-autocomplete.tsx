'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Plus, User } from 'lucide-react'

export interface ClientOption {
  id: string
  name: string
  logo_url: string | null
  brand_color: string | null
}

interface ClientAutocompleteProps {
  value: string
  onChange: (value: string) => void
  /** Optional richer callback with the resolved client id (null for a brand-new name). */
  onClientChange?: (name: string, clientId: string | null) => void
  workspaceId?: string | null
  placeholder?: string
  dir?: string
  inputStyle?: React.CSSProperties
}

export default function ClientAutocomplete({
  value,
  onChange,
  onClientChange,
  workspaceId,
  placeholder = 'בחר לקוח או הוסף חדש',
  dir = 'ltr',
  inputStyle = {},
}: ClientAutocompleteProps) {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (workspaceId) params.set('workspace_id', workspaceId)
    fetch(`/api/clients?${params}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: ClientOption[]) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [workspaceId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const emit = useCallback((name: string, clientId: string | null) => {
    onChange(name)
    onClientChange?.(name, clientId)
  }, [onChange, onClientChange])

  const inputValue = open ? filter : value
  const filtered = clients.filter(c =>
    !filter || c.name.toLowerCase().includes(filter.toLowerCase())
  )
  const trimmed = filter.trim()
  const showAddNew = trimmed && !clients.some(c => c.name.toLowerCase() === trimmed.toLowerCase())

  function handleSelect(c: ClientOption) {
    emit(c.name, c.id)
    setFilter('')
    setOpen(false)
  }

  function handleAddNew() {
    emit(trimmed, null)
    setFilter('')
    setOpen(false)
  }

  function handleInputChange(val: string) {
    setFilter(val)
    // Free typing → clear the resolved id; backend will find-or-create on save
    emit(val, null)
    if (!open) setOpen(true)
  }

  function handleFocus() {
    setOpen(true)
    setFilter(value)
    if (inputRef.current) inputRef.current.style.borderColor = 'var(--admin-accent)'
  }

  function handleBlurBorder() {
    if (inputRef.current) inputRef.current.style.borderColor = 'var(--admin-border)'
  }

  const selected = clients.find(c => c.name === value)

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {selected?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.logo_url} alt="" className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded object-cover" />
        ) : null}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlurBorder}
          placeholder={placeholder}
          dir={dir}
          className={`w-full py-2.5 rounded-lg text-sm outline-none transition-colors ${selected?.logo_url ? 'pr-10' : 'pr-3.5'} pl-9`}
          style={{
            background: 'var(--admin-bg-elevated)',
            border: '1px solid var(--admin-border)',
            color: 'var(--admin-text-primary)',
            ...inputStyle,
          }}
        />
        <ChevronDown
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-transform pointer-events-none ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--admin-text-muted)' }}
        />
      </div>

      {open && (filtered.length > 0 || showAddNew) && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg py-1 shadow-lg max-h-56 overflow-y-auto"
          style={{ background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border)' }}
        >
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleSelect(c)}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-right transition-colors"
              style={{
                color: c.name === value ? 'var(--admin-accent)' : 'var(--admin-text-primary)',
                background: c.name === value ? 'rgba(64,225,211,0.1)' : 'transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = c.name === value ? 'rgba(64,225,211,0.1)' : 'transparent' }}
            >
              {c.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logo_url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
              ) : (
                <span
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: c.brand_color || 'var(--admin-bg)' }}
                >
                  <User className="w-3 h-3" style={{ color: '#fff' }} />
                </span>
              )}
              <span className="flex-1 truncate" dir="auto">{c.name}</span>
            </button>
          ))}

          {showAddNew && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={handleAddNew}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-right transition-colors"
              style={{ color: 'var(--admin-accent)', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-medium">הוסף &quot;{trimmed}&quot; כלקוח חדש</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
