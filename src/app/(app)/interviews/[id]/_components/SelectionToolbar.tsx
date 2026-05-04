'use client'

import type { MarkerType } from '@/types/database'

export type SelectionData = {
  segmentIdx: number
  text: string
  rect: DOMRect
}

const MARKER_TYPES: { type: MarkerType; label: string; color: string }[] = [
  { type: 'quote', label: 'Quote', color: '#B8456D' },
  { type: 'key_moment', label: 'Key moment', color: '#B8842A' },
  { type: 'theme', label: 'Theme', color: '#0E5C5C' },
  { type: 'memo', label: 'Memo', color: '#4A5263' },
]

type Props = {
  selection: SelectionData
  onSelect: (type: MarkerType) => void
  onClose: () => void
  saving: boolean
}

export default function SelectionToolbar({ selection, onSelect, onClose, saving }: Props) {
  // Position above the selection, centered
  const { rect } = selection
  const top = rect.top + window.scrollY - 52
  const left = rect.left + rect.width / 2

  return (
    <>
      {/* Backdrop to close on click-outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        className="fixed z-50 flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-lg"
        style={{
          top,
          left,
          transform: 'translateX(-50%)',
          background: '#1A1F2C',
          border: '1px solid #2D3545',
        }}
      >
        {MARKER_TYPES.map(({ type, label, color }) => (
          <button
            key={type}
            disabled={saving}
            onClick={(e) => { e.stopPropagation(); onSelect(type) }}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
            style={{
              color: '#FAF7F2',
              fontWeight: 500,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `${color}30`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title={`Mark as ${label}`}
          >
            <span
              style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
            />
            {label}
          </button>
        ))}
        <div style={{ width: 1, height: 16, background: '#2D3545', margin: '0 2px' }} />
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="p-1 rounded-lg transition-all"
          style={{ color: '#8A929C' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#FAF7F2')}
          onMouseLeave={e => (e.currentTarget.style.color = '#8A929C')}
          title="Dismiss"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </>
  )
}
