'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function UserMenu({
  initials,
  email,
}: {
  initials: string
  email: string
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2"
        aria-label="User menu"
      >
        <span className="text-sm hidden sm:block" style={{ color: '#4A5263' }}>
          Sravya N.
        </span>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
          style={{ background: '#F7E5EB', color: '#B8456D' }}
        >
          {initials}
        </div>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl py-1"
            style={{
              background: '#FFFFFF',
              border: '1px solid #ECE6D9',
              boxShadow: '0 8px 24px rgb(26 31 44 / 0.1)',
            }}
          >
            <div
              className="px-4 py-2.5 border-b"
              style={{ borderColor: '#ECE6D9' }}
            >
              <p className="text-xs font-medium" style={{ color: '#1A1F2C' }}>
                Sravya N.
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color: '#8A929C' }}>
                {email}
              </p>
            </div>
            <button
              onClick={signOut}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-paper-2"
              style={{ color: '#4A5263' }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
