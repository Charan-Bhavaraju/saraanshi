'use client'

import { useEffect, useRef, useState } from 'react'
import type { TranscriptSegment } from '@/types/database'

type Props = {
  segments: TranscriptSegment[]
  currentTime: number
  onSeek: (seconds: number) => void
  speakerMap: Record<string, string>
  onUpdateSpeaker?: (speakerId: string, label: string) => void
}

// Deterministic color palette — assigned by speaker appearance order in the transcript
const SPEAKER_COLORS = ['#0E5C5C', '#B8456D', '#6B4FA0', '#B8842A']

function buildSpeakerIndex(segments: TranscriptSegment[]): string[] {
  const seen: string[] = []
  for (const seg of segments) {
    if (!seen.includes(seg.speaker)) seen.push(seg.speaker)
  }
  return seen
}

function speakerColor(speakerId: string, order: string[]): string {
  const idx = order.indexOf(speakerId)
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length] ?? '#4A5263'
}

function speakerLabel(speakerId: string, map: Record<string, string>): string {
  return map[speakerId] ?? speakerId
}

function formatTimestamp(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

// Inline-editable speaker chip shown in the toolbar
function SpeakerChip({
  speakerId,
  label,
  color,
  onSave,
}: {
  speakerId: string
  label: string
  color: string
  onSave: (label: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync label prop changes (e.g. after optimistic update settles)
  useEffect(() => { if (!editing) setValue(label) }, [label, editing])

  function commit() {
    const trimmed = value.trim()
    setEditing(false)
    if (trimmed && trimmed !== label) onSave(trimmed)
    else setValue(label)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setEditing(false); setValue(label) }
        }}
        style={{
          width: Math.max(60, value.length * 7 + 16),
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color,
          background: '#FFFFFF',
          border: `1px solid ${color}`,
          borderRadius: 6,
          padding: '2px 6px',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <button
      onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }}
      title={`Rename speaker (${speakerId})`}
      className="flex items-center gap-1.5 transition-all"
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color,
        background: `${color}14`,
        border: `1px solid ${color}30`,
        borderRadius: 6,
        padding: '2px 7px 2px 5px',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
      {/* pencil icon */}
      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.6, flexShrink: 0 }}>
        <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export default function SegmentList({ segments, currentTime, onSeek, speakerMap, onUpdateSpeaker }: Props) {
  const [autoScroll, setAutoScroll] = useState(true)
  const activeRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const speakerOrder = buildSpeakerIndex(segments)
  const activeIdx = segments.findLastIndex(s => currentTime >= s.start)

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
        className="flex items-center gap-3 pb-3 mb-2 flex-wrap"
        style={{ borderBottom: '1px solid #ECE6D9' }}
      >
        <span className="text-xs shrink-0" style={{ color: '#8A929C' }}>
          <strong style={{ color: '#1A1F2C' }}>{segments.length}</strong> segments ·{' '}
          <strong style={{ color: '#1A1F2C' }}>{wordCount.toLocaleString()}</strong> words
        </span>

        {/* Editable speaker chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {speakerOrder.map(spkId => (
            <SpeakerChip
              key={spkId}
              speakerId={spkId}
              label={speakerLabel(spkId, speakerMap)}
              color={speakerColor(spkId, speakerOrder)}
              onSave={label => onUpdateSpeaker?.(spkId, label)}
            />
          ))}
        </div>

        <button
          onClick={() => setAutoScroll(v => !v)}
          className="ml-auto flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-all shrink-0"
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
          const color = speakerColor(seg.speaker, speakerOrder)
          const label = speakerLabel(seg.speaker, speakerMap)

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
                  style={{ letterSpacing: '0.06em', color, fontSize: 10 }}
                >
                  {label}
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
