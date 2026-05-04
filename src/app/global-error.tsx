'use client'

import { useEffect } from 'react'

// Catches crashes in the root layout itself (font loading, providers, etc.)
// Must include its own <html> and <body> tags.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#FAF7F2', fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#FDF0F4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
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

          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1A1F2C', margin: '0 0 8px' }}>
            Application error
          </h1>
          <p style={{ fontSize: 14, color: '#8A929C', margin: '0 0 6px', maxWidth: 360 }}>
            The app encountered a critical error and could not recover automatically.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: '#B5BBC4', fontFamily: 'monospace', margin: '0 0 28px' }}>
              ref: {error.digest}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              onClick={reset}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: '#1A1F2C',
                color: '#FAF7F2',
                fontSize: 14,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/today"
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: '#FFFFFF',
                color: '#4A5263',
                border: '1px solid #ECE6D9',
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Go to Today
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
