import Link from 'next/link'

// Global 404 — renders outside the app shell (no header/auth).
// Redirects unauthenticated users to login; authenticated to app.
export default function GlobalNotFound() {
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
          <p style={{ fontSize: 72, fontWeight: 500, color: '#ECE6D9', lineHeight: 1, marginBottom: 12 }}>
            404
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1A1F2C', margin: '0 0 8px' }}>
            Page not found
          </h1>
          <p style={{ fontSize: 14, color: '#8A929C', margin: '0 0 32px' }}>
            This page doesn&apos;t exist or you may need to sign in.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link
              href="/today"
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: '#1A1F2C',
                color: '#FAF7F2',
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Open app
            </Link>
            <Link
              href="/login"
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
              Sign in
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
