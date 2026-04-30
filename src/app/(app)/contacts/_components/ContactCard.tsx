'use client'

import Link from 'next/link'
import { formatRelativeDate } from '@/lib/utils'
import TypePill from './TypePill'
import type { Contact } from '@/types/database'

export default function ContactCard({ contact }: { contact: Contact }) {
  return (
    <div
      className="relative rounded-xl p-3 transition-all select-none"
      style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = '#B5BBC4'
        el.style.transform = 'translateY(-1px)'
        el.style.boxShadow = '0 1px 2px rgb(26 31 44 / 0.04), 0 4px 16px rgb(26 31 44 / 0.04)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = '#ECE6D9'
        el.style.transform = ''
        el.style.boxShadow = ''
      }}
    >
      {/* Stretched link covers the whole card — sits behind content */}
      <Link
        href={`/contacts/${contact.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={`Open ${contact.displayName}`}
        tabIndex={-1}
      />

      {/* Content sits above the stretched link */}
      <div className="relative">
        {/* Type pill + quick-action links */}
        <div className="flex items-center justify-between mb-1.5">
          <TypePill type={contact.type} />
          <div className="flex gap-1 shrink-0">
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="relative z-10 w-7 h-7 rounded flex items-center justify-center transition-colors"
                style={{ color: '#8A929C' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F1E9'; (e.currentTarget as HTMLElement).style.color = '#1A1F2C' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#8A929C' }}
                title="Call"
                aria-label={`Call ${contact.displayName}`}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1.5 2.5c.3-.8 1.2-1.3 2-.8l.9.6c.5.3.7.9.5 1.4L4.4 5c-.1.3 0 .6.2.8l2.4 2.4c.2.2.5.3.8.2l1.3-.5c.5-.2 1.1 0 1.4.5l.6.9c.5.8 0 1.7-.8 2-1.8.8-4-.2-5.8-2C2.7 6.5 1.7 4.3 1.5 2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </a>
            )}
            {contact.whatsapp && (
              <a
                href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="relative z-10 w-7 h-7 rounded flex items-center justify-center transition-colors"
                style={{ color: '#8A929C' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F1E9'; (e.currentTarget as HTMLElement).style.color = '#1A1F2C' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#8A929C' }}
                title="WhatsApp"
                aria-label={`WhatsApp ${contact.displayName}`}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1a5.5 5.5 0 015.5 5.5 5.5 5.5 0 01-5.5 5.5c-.97 0-1.88-.25-2.67-.69L1 12.5l1.19-2.83A5.49 5.49 0 011 6.5 5.5 5.5 0 016.5 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </a>
            )}
          </div>
        </div>

        <p className="text-sm font-medium leading-snug truncate" style={{ color: '#1A1F2C' }}>
          {contact.displayName}
        </p>
        {(contact.organization || contact.role) && (
          <p className="text-xs mt-0.5 truncate" style={{ color: '#8A929C' }}>
            {[contact.role, contact.organization].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between mt-2.5 pt-2"
          style={{ borderTop: '1px solid #ECE6D9' }}
        >
          <div className="flex gap-1 flex-wrap min-w-0">
            {contact.tags?.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: '#F5F1E9',
                  color: '#4A5263',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          {contact.lastContactAt && (
            <span className="text-xs shrink-0" style={{ color: '#B5BBC4' }}>
              {formatRelativeDate(contact.lastContactAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
