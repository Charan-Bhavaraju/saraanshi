'use client'

import { useEffect, useRef, useState } from 'react'
import type { TranscriptSegment } from '@/types/database'

type Props = {
  segments: TranscriptSegment[]
  currentTime: number          // audio playhead position in seconds
  onSeek: (seconds: number) => void
}

// Map raw speaker codes to display labels
// SPEAKER_1 is typically the interviewer (Sravya), SPEAKER_2+ the respondent
const SPEAKER_LABELS: Record<string, { label: string; color: string }> = {
  SPEAKER_1: { label: 'Sravya', color: '#0E5C5C' },
  SPEAKER_2: { label: 'Respondent', color: '#B8456D' },
}

function getSpeakerStyle(speaker: string) {
  return SPEAKER_LABELS[speaker] ?? { label: speaker, color: '#4A5263' }
}

function formatTimestamp(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function SegmentList({ segments, currentTime, onSeek }: Props) {
  const [autoScroll, setAutoScroll] = useState(true)
  const activeRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Find active segment index
  const activeIdx = segments.findLastIndex(s => currentTime >= s.start)

  // Auto-scroll to active segment
  useEffect(() => {
    if (!autoScroll || !activeRef.current) return
    activeRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIdx, autoScroll])

  const wordCount = segments.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0)

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <p className="text-sm" style={{ color: '#8A929C' }}>No transcript segments yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-4 pb-3 mb-2 flex-wrap"
        style={{ borderBottom: '1px solid #ECE6D9' }}
      >
        <span className="text-xs" style={{ color: '#8A929C' }}>
          <strong style={{ color: '#1A1F2C' }}>{segments.length}</strong> segments ·{' '}
          <strong style={{ color: '#1A1F2C' }}>{wordCount.toLocaleString()}</strong> words
        </span>
        <button
          onClick={() => setAutoScroll(v => !v)}
          className="ml-auto flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-all"
          style={{
            border: `1px solid ${autoScroll ? '#0E5C5C' : '#ECE6D9'}`,
            background: autoScroll ? '#E2EEEC' : '#FFFFFF',
            color: autoScroll ? '#0E5C5C' : '#8A929C',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M3 8l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Auto-scroll
        </button>
      </div>

      {/* Segments */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {segments.map((seg, idx) => {
          const isActive = idx === activeIdx
          const spk = getSpeakerStyle(seg.speaker)

          return (
            <div
              key={idx}
              ref={isActive ? activeRef : null}
              onClick={() => onSeek(seg.start)}
              className="px-3 py-2.5 rounded-lg mb-1 cursor-pointer transition-all"
              style={{
                background: isActive ? '#FFF8E8' : 'transparent',
                boxShadow: isActive ? 'inset 3px 0 0 #B8842A' : 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = '#F5F1E9'
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {/* Segment header: timestamp + speaker */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="shrink-0"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: isActive ? '#B8842A' : '#B5BBC4',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  [{formatTimestamp(seg.start)}]
                </span>
                <span
                  className="text-xs font-semibold uppercase shrink-0"
                  style={{ letterSpacing: '0.06em', color: spk.color, fontSize: 10 }}
                >
                  {spk.label}
                </span>
                {seg.editedByHuman && (
                  <span
                    className="text-xs px-1 rounded"
                    style={{ background: '#F5EBD3', color: '#B8842A', fontSize: 9 }}
                  >
                    edited
                  </span>
                )}
              </div>

              {/* Segment text — Noto Sans Telugu ensures correct Telugu Unicode rendering */}
              <p
                className="text-sm leading-relaxed"
                style={{
                  color: isActive ? '#1A1F2C' : '#4A5263',
                  fontFamily: "'Noto Sans Telugu', 'Noto Sans', var(--font-sans), sans-serif",
                  lineHeight: 1.65,
                }}
              >
                {seg.text}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
