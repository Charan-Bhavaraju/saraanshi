'use client'

import { useState, useTransition } from 'react'
import { revealRealName } from './actions'

export default function RealNameRevealButton({ contactId }: { contactId: string }) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleReveal() {
    startTransition(async () => {
      const name = await revealRealName(contactId)
      setRevealed(name ?? '(empty)')
    })
  }

  if (revealed) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium" style={{ color: '#1A1F2C' }}>
          {revealed}
        </span>
        <button
          onClick={() => setRevealed(null)}
          className="text-xs"
          style={{ color: '#8A929C' }}
        >
          Hide
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleReveal}
      disabled={isPending}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        border: '1px solid #DDD4C2',
        background: '#FFFFFF',
        color: '#4A5263',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      {isPending ? 'Decrypting…' : 'Show real name'}
    </button>
  )
}
