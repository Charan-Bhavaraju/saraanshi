'use client'

import { useState, useRef, useEffect } from 'react'

const FORMATS = [
  { key: 'txt', label: 'Plain text', ext: '.txt', description: 'Speaker text, no timestamps' },
  { key: 'txt-ts', label: 'Text + timestamps', ext: '.txt', description: 'With [mm:ss] and speaker labels' },
  { key: 'srt', label: 'SRT subtitles', ext: '.srt', description: 'SubRip format' },
  { key: 'vtt', label: 'WebVTT', ext: '.vtt', description: 'Web caption format' },
  { key: 'docx', label: 'Word document', ext: '.docx', description: 'Formatted with speaker headers' },
  { key: 'quotes', label: 'Quotes only', ext: '.txt', description: 'Marked quote excerpts' },
] as const

type Props = { interviewId: string }

export default function ExportMenu({ interviewId }: Props) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
        style={{
          border: '1px solid #ECE6D9',
          background: open ? '#F5F1E9' : '#FFFFFF',
          color: '#4A5263',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v7M3 5l3 4 3-4M1.5 10h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Export
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden z-50 py-1 w-56"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
        >
          {FORMATS.map(({ key, label, ext, description }) => (
            <a
              key={key}
              href={`/api/interviews/${interviewId}/export?format=${key}`}
              download
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-2.5 transition-all"
              style={{ color: '#1A1F2C', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F5F1E9')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">{label}</span>
                  <span
                    className="text-xs"
                    style={{ color: '#B5BBC4', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                  >
                    {ext}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#8A929C' }}>{description}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
