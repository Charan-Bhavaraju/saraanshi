'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AppError]', error)
  }, [error])

  return (
    <div className="max-w-lg mx-auto px-6 py-20 flex flex-col items-center text-center">
      <div
        className="flex items-center justify-center rounded-full mb-5"
        style={{ width: 52, height: 52, background: '#FDF0F4' }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path
            d="M11 7v5M11 15h.01M3.5 18.5l7.5-14 7.5 14H3.5z"
            stroke="#B8456D"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1
        className="text-2xl mb-2"
        style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em', color: '#1A1F2C' }}
      >
        Something went wrong
      </h1>
      <p className="text-sm mb-2" style={{ color: '#8A929C' }}>
        An unexpected error occurred. You can try again or head back to the dashboard.
      </p>
      {error.digest && (
        <p className="text-xs mb-6 font-mono" style={{ color: '#B5BBC4' }}>
          ref: {error.digest}
        </p>
      )}

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: '#1A1F2C', color: '#FAF7F2', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2E3444' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1A1F2C' }}
        >
          Try again
        </button>
        <Link
          href="/today"
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: '#FFFFFF', color: '#4A5263', border: '1px solid #ECE6D9' }}
        >
          Go to Today
        </Link>
      </div>
    </div>
  )
}
