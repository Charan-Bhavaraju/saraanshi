'use client'

import { useState } from 'react'
import QuickAddForm from './QuickAddForm'

export default function FAB() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Quick add panel */}
      {open && (
        <div
          className="fixed left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-40"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <QuickAddForm onDone={() => setOpen(false)} />
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed right-5 z-50 flex items-center justify-center rounded-full transition-all sm:right-7"
        style={{
          bottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          width: 52,
          height: 52,
          background: open ? '#4A5263' : '#1A1F2C',
          color: '#FAF7F2',
          border: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}
        aria-label={open ? 'Close quick add' : 'Add task'}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          style={{
            transform: open ? 'rotate(45deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        >
          <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </>
  )
}
