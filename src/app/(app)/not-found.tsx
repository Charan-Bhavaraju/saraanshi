import Link from 'next/link'

export default function AppNotFound() {
  return (
    <div className="max-w-lg mx-auto px-6 py-20 flex flex-col items-center text-center">
      <div
        className="flex items-center justify-center rounded-full mb-5"
        style={{ width: 52, height: 52, background: '#F5F1E9' }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="8" stroke="#B5BBC4" strokeWidth="1.5" />
          <path d="M8.5 8.5c.4-1 1.4-1.5 2.5-1.5s2 .8 2 1.8c0 1.5-2 1.5-2 3M11 15.5h.01" stroke="#B5BBC4" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <p
        className="text-5xl font-medium mb-3"
        style={{ fontFamily: 'var(--font-serif)', color: '#ECE6D9', letterSpacing: '-0.03em' }}
      >
        404
      </p>
      <h1
        className="text-2xl mb-2"
        style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em', color: '#1A1F2C' }}
      >
        Page not found
      </h1>
      <p className="text-sm mb-8" style={{ color: '#8A929C' }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/today"
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#1A1F2C', color: '#FAF7F2' }}
        >
          Go to Today
        </Link>
        <Link
          href="/interviews"
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#FFFFFF', color: '#4A5263', border: '1px solid #ECE6D9' }}
        >
          Interviews
        </Link>
      </div>
    </div>
  )
}
