'use client'

import { useState, useMemo } from 'react'
import type { Contact, ContactType } from '@/types/database'
import ContactKanban from './ContactKanban'
import ContactList from './ContactList'
import ContactForm from './ContactForm'

const TYPE_FILTERS: { type: ContactType | 'all'; label: string }[] = [
  { type: 'all', label: 'All' },
  { type: 'hospital', label: 'Hospitals' },
  { type: 'doctor', label: 'Doctors' },
  { type: 'patient', label: 'Patients' },
  { type: 'survivor', label: 'Survivors' },
  { type: 'receptionist', label: 'Staff' },
]

type ViewMode = 'list' | 'kanban'

export default function ContactsClient({
  contacts,
  defaultView,
}: {
  contacts: Contact[]
  defaultView: ViewMode
}) {
  const [view, setView] = useState<ViewMode>(defaultView)
  const [typeFilter, setTypeFilter] = useState<ContactType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const filtered = useMemo(() => {
    let result = contacts
    if (typeFilter !== 'all') result = result.filter(c => c.type === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        c =>
          c.displayName.toLowerCase().includes(q) ||
          c.organization?.toLowerCase().includes(q) ||
          c.role?.toLowerCase().includes(q) ||
          c.location?.toLowerCase().includes(q) ||
          c.tags?.some(t => t.toLowerCase().includes(q)),
      )
    }
    return result
  }, [contacts, typeFilter, search])

  const counts = useMemo(() => ({
    all: contacts.length,
    hospital: contacts.filter(c => c.type === 'hospital').length,
    doctor: contacts.filter(c => c.type === 'doctor').length,
    patient: contacts.filter(c => c.type === 'patient').length,
    survivor: contacts.filter(c => c.type === 'survivor').length,
    receptionist: contacts.filter(c => c.type === 'receptionist').length,
  }), [contacts])

  const countFor = (type: ContactType | 'all') =>
    type === 'all' ? counts.all : (counts[type as keyof typeof counts] ?? 0)

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1
            className="text-3xl tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }}
          >
            Contacts
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#8A929C' }}>
            {contacts.length} lead{contacts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity active:opacity-70 shrink-0"
          style={{ background: '#0E5C5C', color: '#FFFFFF', border: '1px solid #0E5C5C', minHeight: 44 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Add contact
        </button>
      </div>

      {/* Filter bar — chips scroll on mobile, view toggle + search below */}
      <div className="mb-5 space-y-2">
        {/* Row 1: scrollable type chips + view toggle */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 pb-0.5">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.type}
                onClick={() => setTypeFilter(f.type)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:opacity-70"
                style={{
                  border: '1px solid',
                  borderColor: typeFilter === f.type ? '#1A1F2C' : '#DDD4C2',
                  background: typeFilter === f.type ? '#1A1F2C' : '#FFFFFF',
                  color: typeFilter === f.type ? '#FAF7F2' : '#4A5263',
                  minHeight: 32,
                  whiteSpace: 'nowrap',
                }}
              >
                {f.label} · {countFor(f.type)}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div
            className="flex gap-0.5 shrink-0"
            style={{ background: '#F5F1E9', padding: 3, borderRadius: 8, border: '1px solid #ECE6D9' }}
          >
            {(['list', 'kanban'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md transition-all"
                style={{
                  background: view === v ? '#FFFFFF' : 'transparent',
                  color: view === v ? '#1A1F2C' : '#4A5263',
                  boxShadow: view === v ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                  minHeight: 30,
                }}
              >
                {v === 'list' ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="List view">
                    <path d="M2 4h10M2 7h10M2 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Kanban view">
                    <rect x="1" y="2" width="3.5" height="10" rx="1" stroke="currentColor" strokeWidth="1.3" />
                    <rect x="5.25" y="2" width="3.5" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
                    <rect x="9.5" y="2" width="3.5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: search (full width) */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            style={{ color: '#B5BBC4' }}
          >
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition-all"
            style={{
              border: '1px solid #DDD4C2',
              background: '#FFFFFF',
              color: '#1A1F2C',
              minHeight: 38,
            }}
            onFocus={e => { e.target.style.borderColor = '#0E5C5C'; e.target.style.boxShadow = '0 0 0 3px #E2EEEC' }}
            onBlur={e => { e.target.style.borderColor = '#DDD4C2'; e.target.style.boxShadow = 'none' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center"
              style={{ color: '#B5BBC4' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Views */}
      {view === 'kanban' ? (
        <ContactKanban contacts={filtered} />
      ) : (
        <ContactList contacts={filtered} />
      )}

      {/* Add contact modal */}
      {showForm && (
        <Modal title="Add contact" onClose={() => setShowForm(false)}>
          <ContactForm onDone={() => setShowForm(false)} />
        </Modal>
      )}
    </>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(26, 31, 44, 0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl max-h-[92vh] overflow-y-auto"
        style={{
          background: '#FFFFFF',
          border: '1px solid #ECE6D9',
          boxShadow: '0 24px 48px rgb(26 31 44 / 0.2)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0"
          style={{ borderBottom: '1px solid #ECE6D9', background: '#FFFFFF', zIndex: 1 }}
        >
          <h2
            className="text-lg"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#8A929C' }}
            onMouseEnter={e => { (e.currentTarget).style.background = '#F5F1E9' }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
