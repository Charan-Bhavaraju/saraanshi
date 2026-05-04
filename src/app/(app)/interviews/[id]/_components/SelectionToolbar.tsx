'use client'

import { useEffect, useRef } from 'react'
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
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Dismiss when user clicks anywhere outside the toolbar.
  // Using mousedown (not click) so navigation clicks still fire their click event after dismissal.
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  // Also dismiss when the text selection collapses (user deselected)
  useEffect(() => {
    function handleSelectionChange() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) onClose()
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [onClose])

  const { rect } = selection
  // position: fixed is viewport-relative — do NOT add scrollY
  const top = Math.max(8, rect.top - 52)
  const left = rect.left + rect.width / 2

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-lg"
      style={{
        top,
        left,
        transform: 'translateX(-50%)',
        background: '#1A1F2C',
        border: '1px solid #2D3545',
        pointerEvents: saving ? 'none' : 'auto',
        opacity: saving ? 0.7 : 1,
      }}
    >
      {MARKER_TYPES.map(({ type, label, color }) => (
        <button
          key={type}
          disabled={saving}
          onMouseDown={e => e.stopPropagation()} // keep toolbar open on internal clicks
          onClick={() => onSelect(type)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
          style={{ color: '#FAF7F2', fontWeight: 500 }}
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
        onMouseDown={e => e.stopPropagation()}
        onClick={onClose}
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
  )
}
