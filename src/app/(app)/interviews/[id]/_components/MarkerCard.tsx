'use client'

import { useState } from 'react'
import type { Marker, MarkerType } from '@/types/database'

const TYPE_CONFIG: Record<MarkerType, { label: string; color: string; bg: string }> = {
  quote:      { label: 'Quote',      color: '#B8456D', bg: '#FDF0F4' },
  key_moment: { label: 'Key moment', color: '#B8842A', bg: '#FDF5E9' },
  theme:      { label: 'Theme',      color: '#0E5C5C', bg: '#E2EEEC' },
  memo:       { label: 'Memo',       color: '#4A5263', bg: '#F5F1E9' },
}

type Props = {
  marker: Marker
  segmentTimestamp?: number
  onDelete: (markerId: string) => void
  onUpdateNote: (markerId: string, note: string, tags: string[]) => void
}

function formatTimestamp(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function MarkerCard({ marker, segmentTimestamp, onDelete, onUpdateNote }: Props) {
  const cfg = TYPE_CONFIG[marker.type as MarkerType] ?? TYPE_CONFIG.memo
  const [editingNote, setEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(marker.note ?? '')
  const [deleting, setDeleting] = useState(false)

  function commitNote() {
    setEditingNote(false)
    const trimmed = noteValue.trim()
    if (trimmed !== (marker.note ?? '')) {
      onUpdateNote(marker.id, trimmed, marker.tags ?? [])
    }
  }

  async function handleDelete() {
    setDeleting(true)
    onDelete(marker.id)
  }

  return (
    <div
      className="rounded-xl p-3 mb-2"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.color}20`,
        opacity: deleting ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, display: 'inline-block' }}
          />
          <span
            className="text-xs font-semibold uppercase"
            style={{ color: cfg.color, letterSpacing: '0.06em', fontSize: 9 }}
          >
            {cfg.label}
          </span>
          {segmentTimestamp !== undefined && (
            <span className="text-xs" style={{ color: '#B5BBC4', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              [{formatTimestamp(segmentTimestamp)}]
            </span>
          )}
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-0.5 rounded transition-all"
          style={{ color: '#B5BBC4' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#B8456D')}
          onMouseLeave={e => (e.currentTarget.style.color = '#B5BBC4')}
          title="Remove marker"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Excerpt */}
      {marker.excerpt && (
        <p
          className="text-xs leading-relaxed mb-2 px-2 py-1.5 rounded-lg"
          style={{
            background: `${cfg.color}12`,
            color: '#4A5263',
            fontFamily: "'Noto Sans Telugu', 'Noto Sans', var(--font-sans), sans-serif",
            lineHeight: 1.65,
            borderLeft: `2px solid ${cfg.color}50`,
          }}
        >
          "{marker.excerpt}"
        </p>
      )}

      {/* Note */}
      {editingNote ? (
        <textarea
          value={noteValue}
          onChange={e => setNoteValue(e.target.value)}
          onBlur={commitNote}
          onKeyDown={e => {
            if (e.key === 'Escape') { setEditingNote(false); setNoteValue(marker.note ?? '') }
          }}
          autoFocus
          rows={2}
          placeholder="Add a note…"
          className="w-full text-xs rounded-lg px-2 py-1.5 resize-none"
          style={{
            background: '#FFFFFF',
            border: `1px solid ${cfg.color}40`,
            color: '#4A5263',
            outline: 'none',
            lineHeight: 1.6,
          }}
        />
      ) : (
        <button
          onClick={() => setEditingNote(true)}
          className="w-full text-left text-xs rounded-lg px-2 py-1.5 transition-all"
          style={{
            color: noteValue ? '#4A5263' : '#B5BBC4',
            background: noteValue ? 'transparent' : 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = `${cfg.color}10`)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {noteValue || 'Add a note…'}
        </button>
      )}

      {/* Tags */}
      {(marker.tags ?? []).length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {(marker.tags ?? []).map(tag => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: `${cfg.color}15`, color: cfg.color, fontSize: 9 }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
