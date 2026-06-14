'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import UserMenu from './UserMenu'

const TABS = [
  { href: '/today', label: 'Today' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/interviews', label: 'Interviews' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/analysis', label: 'Analysis' },
] as const

export default function AppHeader({
  userInitials,
  userEmail,
}: {
  userInitials: string
  userEmail: string
}) {
  const pathname = usePathname()

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 gap-3"
      style={{
        background: 'rgba(250, 247, 242, 0.92)',
        backdropFilter: 'saturate(150%) blur(10px)',
        WebkitBackdropFilter: 'saturate(150%) blur(10px)',
        borderBottom: '1px solid #ECE6D9',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ background: '#0E5C5C', width: 28, height: 28, minWidth: 28, minHeight: 28 }}
        >
          <svg viewBox="0 0 512 512" width="17" height="17" aria-hidden="true" style={{ color: '#FAF7F2' }}>
            <path
              d="M 256 128 Q 144 232 144 320 Q 144 392 256 392 Q 368 392 368 320 Q 368 232 256 128 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              strokeLinejoin="round"
            />
            <circle cx="256" cy="304" r="20" fill="currentColor" />
          </svg>
        </div>
        <span
          className="text-lg hidden sm:block"
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
          }}
        >
          Saaranshi
        </span>
        <span
          className="text-xs hidden md:block pl-2.5"
          style={{
            color: '#8A929C',
            borderLeft: '1px solid #DDD4C2',
          }}
        >
          Research companion
        </span>
      </div>

      {/* Tab navigation */}
      <nav
        className="flex gap-0.5 overflow-x-auto no-scrollbar"
        style={{
          background: '#F5F1E9',
          padding: 3,
          borderRadius: 8,
          border: '1px solid #ECE6D9',
        }}
      >
        {TABS.map(tab => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              className={cn(
                'px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-md transition-all',
                active
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink-2 hover:text-ink',
              )}
              style={{
                color: active ? '#1A1F2C' : '#4A5263',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : undefined,
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* User pill */}
      <UserMenu initials={userInitials} email={userEmail} />
    </header>
  )
}
