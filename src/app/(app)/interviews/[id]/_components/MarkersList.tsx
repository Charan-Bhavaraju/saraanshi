'use client'

import { useState } from 'react'
import type { Marker, MarkerType, TranscriptSegment } from '@/types/database'
import MarkerCard from './MarkerCard'

type Filter = 'all' | MarkerType

const FILTER_OPTIONS: { key: Filter; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: '#4A5263' },
  { key: 'quote', label: 'Quote', color: '#B8456D' },
  { key: 'key_moment', label: 'Key', color: '#B8842A' },
  { key: 'theme', label: 'Theme', color: '#0E5C5C' },
  { key: 'memo', label: 'Memo', color: '#4A5263' },
]

type Props = {
  markers: Marker[]
  segments: TranscriptSegment[]
  onDelete: (markerId: string) => void
  onUpdateNote: (markerId: string, note: string, tags: string[]) => void
}

export default function MarkersList({ markers, segments, onDelete, onUpdateNote }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filter === 'all' ? markers : markers.filter(m => m.type === filter)

  const counts: Record<Filter, number> = {
    all: markers.length,
    quote: markers.filter(m => m.type === 'quote').length,
    key_moment: markers.filter(m => m.type === 'key_moment').length,
    theme: markers.filter(m => m.type === 'theme').length,
    memo: markers.filter(m => m.type === 'memo').length,
  }

  if (markers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M6 8h16M6 14h10M6 20h7" stroke="#DDD4C2" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-xs leading-relaxed" style={{ color: '#C5BBAD' }}>
          Tag themes and<br />key moments here
        </p>
        <p className="text-xs mt-1" style={{ color: '#DDD4C2' }}>
          Select text in the transcript<br />to create a marker
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter chips */}
      <div className="flex gap-1 flex-wrap pb-3 mb-3" style={{ borderBottom: '1px solid #ECE6D9' }}>
        {FILTER_OPTIONS.map(({ key, label, color }) => {
          const isActive = filter === key
          const count = counts[key]
          if (count === 0 && key !== 'all') return null
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all"
              style={{
                border: `1px solid ${isActive ? color : '#ECE6D9'}`,
                background: isActive ? `${color}15` : '#FFFFFF',
                color: isActive ? color : '#8A929C',
                fontSize: 10,
              }}
            >
              {label}
              {key !== 'all' && count > 0 && (
                <span style={{ fontSize: 9 }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Markers */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: '#B5BBC4' }}>
            No {filter.replace('_', ' ')} markers yet.
          </p>
        ) : (
          filtered.map(marker => (
            <MarkerCard
              key={marker.id}
              marker={marker}
              segmentTimestamp={segments[marker.segmentIdx]?.start}
              onDelete={onDelete}
              onUpdateNote={onUpdateNote}
            />
          ))
        )}
      </div>
    </div>
  )
}
