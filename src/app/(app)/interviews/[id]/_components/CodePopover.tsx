'use client'

import { useEffect, useRef, useState } from 'react'
import {
  listThemesForCoding,
  createThemeForCoding,
  codePassage,
  suggestThemesForExcerpt,
  type CodingTheme,
} from '../coding/actions'
import type { SelectionData } from './SelectionToolbar'

type Props = {
  interviewId: string
  selection: SelectionData
  onClose: () => void
  onCoded?: (count: number) => void
}

export default function CodePopover({ interviewId, selection, onClose, onCoded }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [themes, setThemes] = useState<CodingTheme[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const [suggestions, setSuggestions] = useState<CodingTheme[]>([])
  const [suggesting, setSuggesting] = useState(true)

  // Load existing themes immediately (does not block on embeddings).
  useEffect(() => {
    listThemesForCoding().then(t => { setThemes(t); setLoaded(true) }).catch(() => setLoaded(true))
  }, [])

  // Similarity suggestions load asynchronously — never blocks the list.
  useEffect(() => {
    suggestThemesForExcerpt(selection.text, [])
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setSuggesting(false))
  }, [selection.text])

  // Dismiss on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function createAndSelect() {
    const name = query.trim()
    if (!name) return
    const t = await createThemeForCoding(name)
    setThemes(prev => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)))
    setSelected(prev => new Set(prev).add(t.id))
    setQuery('')
  }

  async function apply() {
    if (selected.size === 0) return
    setSaving(true)
    try {
      const { coded } = await codePassage({
        interviewId,
        segmentIdx: selection.segmentIdx,
        excerpt: selection.text,
        themeIds: [...selected],
      })
      onCoded?.(coded)
      window.getSelection()?.removeAllRanges()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const filtered = themes.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
  const exactMatch = themes.some(t => t.name.toLowerCase() === query.trim().toLowerCase())

  // Position below the selection, clamped to the viewport.
  const top = Math.min(selection.rect.bottom + 8, window.innerHeight - 360)
  const left = Math.max(8, Math.min(selection.rect.left, window.innerWidth - 320))

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-xl shadow-lg flex flex-col"
      style={{ top, left, width: 300, maxHeight: 360, background: '#FFFFFF', border: '1px solid #DDD4C2' }}
    >
      <div className="p-2.5" style={{ borderBottom: '1px solid #ECE6D9' }}>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search or create a theme…"
          className="w-full text-sm rounded-lg px-2.5 py-1.5"
          style={{ background: '#FAF7F2', border: '1px solid #ECE6D9', color: '#1A1F2C' }}
        />
      </div>

      <div className="flex-1 overflow-auto p-1.5">
        {!loaded ? (
          <p className="text-xs px-2 py-2" style={{ color: '#8A929C' }}>Loading themes…</p>
        ) : (
          <>
            {query.trim() && !exactMatch && (
              <button
                onClick={createAndSelect}
                className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-all"
                style={{ color: '#0E5C5C' }}
              >
                + Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
            {filtered.map(t => (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className="w-full flex items-center gap-2 text-left text-sm px-2.5 py-1.5 rounded-lg transition-all"
                style={{ background: selected.has(t.id) ? '#E2EEEC' : 'transparent' }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.color ?? '#B5BBC4', flexShrink: 0 }} />
                <span className="flex-1 truncate" style={{ color: '#1A1F2C' }}>{t.name}</span>
                {selected.has(t.id) && <span style={{ color: '#0E5C5C' }}>✓</span>}
              </button>
            ))}
            {filtered.length === 0 && !query.trim() && (
              <p className="text-xs px-2 py-2" style={{ color: '#8A929C' }}>No themes yet — type to create one.</p>
            )}

            {/* Async similarity suggestions */}
            <div className="mt-1.5 pt-1.5" style={{ borderTop: '1px solid #ECE6D9' }}>
              {suggesting ? (
                <p className="text-xs px-2 py-1" style={{ color: '#B5BBC4' }}>Suggesting related themes…</p>
              ) : (
                suggestions.filter(s => !selected.has(s.id)).length > 0 && (
                  <div className="px-1">
                    <p className="text-xs px-1 mb-1" style={{ color: '#8A929C' }}>May also fit:</p>
                    <div className="flex flex-wrap gap-1">
                      {suggestions.filter(s => !selected.has(s.id)).map(s => (
                        <button
                          key={s.id}
                          onClick={() => toggle(s.id)}
                          className="text-xs px-2 py-0.5 rounded-md transition-all"
                          style={{ background: '#FFF8E8', border: '1px solid #F0E4BC', color: '#B8842A' }}
                        >
                          + {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>

      <div className="p-2.5 flex items-center justify-between gap-2" style={{ borderTop: '1px solid #ECE6D9' }}>
        <span className="text-xs" style={{ color: '#8A929C' }}>{selected.size} selected</span>
        <div className="flex items-center gap-1.5">
          <button onClick={onClose} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#8A929C' }}>Cancel</button>
          <button onClick={apply} disabled={saving || selected.size === 0} className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all disabled:opacity-50" style={{ background: '#0E5C5C', color: '#FAF7F2' }}>
            {saving ? 'Coding…' : 'Code passage'}
          </button>
        </div>
      </div>
    </div>
  )
}
