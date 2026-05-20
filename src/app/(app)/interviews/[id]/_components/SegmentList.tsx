'use client'

import { useEffect, useRef, useState } from 'react'
import type { TranscriptSegment, TranslationSegment, Marker, MarkerType } from '@/types/database'
import type { SelectionData } from './SelectionToolbar'

type Props = {
  segments: TranscriptSegment[]
  currentTime: number
  onSeek: (seconds: number) => void
  speakerMap: Record<string, string>
  onUpdateSpeaker?: (speakerId: string, label: string) => void
  onTextSelect?: (data: SelectionData) => void
  onEditSave?: (segmentIdx: number, text: string) => void
  onTranslationEdit?: (segmentIdx: number, enText: string) => void
  onHide?: (segmentIdx: number) => void
  onUnhide?: (segmentIdx: number) => void
  markers?: Marker[]
  translationSegments?: TranslationSegment[]
  showTranslation?: boolean
  hideSource?: boolean
}

const SPEAKER_COLORS = ['#0E5C5C', '#B8456D', '#6B4FA0', '#B8842A']

const MARKER_TYPE_COLORS: Record<MarkerType, string> = {
  quote: '#B8456D',
  key_moment: '#B8842A',
  theme: '#0E5C5C',
  memo: '#4A5263',
}

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
        style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }}
      />
      {label}
      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.6, flexShrink: 0 }}>
        <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function SegmentRow({
  seg,
  idx,
  isActive,
  color,
  label,
  translation,
  showTranslation,
  hideSource,
  segmentMarkers,
  onSeek,
  onTextSelect,
  onEditSave,
  onTranslationEdit,
  onHide,
  onUnhide,
  activeRef,
}: {
  seg: TranscriptSegment
  idx: number
  isActive: boolean
  color: string
  label: string
  translation?: TranslationSegment
  showTranslation?: boolean
  hideSource?: boolean
  segmentMarkers: Marker[]
  onSeek: (s: number) => void
  onTextSelect?: (data: SelectionData) => void
  onEditSave?: (idx: number, text: string) => void
  onTranslationEdit?: (idx: number, enText: string) => void
  onHide?: (idx: number) => void
  onUnhide?: (idx: number) => void
  activeRef: React.RefCallback<HTMLDivElement>
}) {
  const [hovering, setHovering] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(seg.text)
  const [editingEn, setEditingEn] = useState(false)
  const [enValue, setEnValue] = useState(translation?.enText ?? '')
  const textRef = useRef<HTMLParagraphElement>(null)

  // Sync values when props change
  useEffect(() => { if (!editing) setEditValue(seg.text) }, [seg.text, editing])
  useEffect(() => { if (!editingEn) setEnValue(translation?.enText ?? '') }, [translation?.enText, editingEn])

  function handleMouseUp(e: React.MouseEvent) {
    if (editing || !onTextSelect) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return
    if (!textRef.current?.contains(sel.anchorNode)) return
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    onTextSelect({ segmentIdx: idx, text: sel.toString().trim(), rect })
  }

  function handleRowClick(e: React.MouseEvent) {
    // Don't seek if clicking on interactive elements (buttons, inputs, speaker chip area)
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('textarea')) return
    // Don't seek if the user just finished selecting text
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) return
    onSeek(seg.start)
  }

  function commitEdit() {
    setEditing(false)
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== seg.text) {
      onEditSave?.(idx, trimmed)
    } else {
      setEditValue(seg.text)
    }
  }

  // Colored marker dots for types present on this segment
  const markerTypes = [...new Set(segmentMarkers.map(m => m.type as MarkerType))]

  return (
    <div
      ref={activeRef}
      className="relative px-3 py-2.5 rounded-lg mb-1 transition-all"
      style={{
        background: seg.hidden ? '#FAF9F7' : isActive ? '#FFF8E8' : 'transparent',
        boxShadow: isActive && !seg.hidden ? 'inset 3px 0 0 #B8842A' : 'none',
        cursor: editing ? 'default' : 'pointer',
        opacity: seg.hidden ? 0.55 : 1,
      }}
      onClick={seg.hidden ? undefined : handleRowClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={() => onSeek(seg.start)}
          title="Seek to segment"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: isActive ? '#B8842A' : '#B5BBC4',
              fontWeight: isActive ? 500 : 400,
            }}
          >
            [{formatTimestamp(seg.start)}]
          </span>
        </button>
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
        {/* Marker type dots */}
        {markerTypes.length > 0 && (
          <div className="flex items-center gap-0.5 ml-1">
            {markerTypes.map(t => (
              <span
                key={t}
                title={t.replace('_', ' ')}
                style={{ width: 6, height: 6, borderRadius: '50%', background: MARKER_TYPE_COLORS[t], display: 'inline-block' }}
              />
            ))}
          </div>
        )}
        {/* Edit pencil */}
        {onEditSave && hovering && !editing && !seg.hidden && (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true) }}
            className="ml-auto p-0.5 rounded transition-all"
            style={{ color: '#B5BBC4', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#4A5263')}
            onMouseLeave={e => (e.currentTarget.style.color = '#B5BBC4')}
            title="Edit segment text"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {/* Hide / restore */}
        {seg.hidden ? (
          onUnhide && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnhide(idx) }}
              className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded transition-all text-xs"
              style={{ color: '#8A929C', border: '1px solid #ECE6D9' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#E2EEEC'; (e.currentTarget as HTMLElement).style.color = '#0E5C5C' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8A929C' }}
              title="Restore segment"
            >
              Restore
            </button>
          )
        ) : (
          onHide && hovering && !editing && (
            <button
              onClick={(e) => { e.stopPropagation(); onHide(idx) }}
              className="p-0.5 rounded transition-all"
              style={{ color: '#B5BBC4', flexShrink: 0, marginLeft: onEditSave ? 2 : 'auto' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#B8456D'; (e.currentTarget as HTMLElement).style.background = '#FDF0F4' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#B5BBC4'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              title="Hide filler segment"
            >
              <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )
        )}
      </div>

      {showTranslation && translation ? (
        hideSource ? (
          /* EN-only mode: single wide column, document-like */
          <div
            className="rounded-lg px-3 py-2 mt-0.5 group/en"
            style={{ background: '#F0F7F7', borderLeft: '2px solid #0E5C5C40', cursor: editingEn ? 'default' : 'text' }}
            onClick={() => { if (!editingEn && onTranslationEdit) setEditingEn(true) }}
          >
            {editingEn ? (
              <textarea
                value={enValue}
                onChange={e => setEnValue(e.target.value)}
                onBlur={() => {
                  setEditingEn(false)
                  const trimmed = enValue.trim()
                  if (trimmed !== (translation?.enText ?? '')) onTranslationEdit?.(idx, trimmed)
                }}
                onKeyDown={e => { if (e.key === 'Escape') { setEditingEn(false); setEnValue(translation?.enText ?? '') } }}
                autoFocus
                rows={Math.max(2, enValue.split('\n').length)}
                className="w-full resize-none outline-none"
                style={{ fontSize: 14, lineHeight: 1.7, color: '#1A1F2C', background: 'transparent' }}
              />
            ) : (
              <div className="relative">
                <p style={{ fontSize: 14, lineHeight: 1.7, color: '#1A1F2C' }}>
                  {translation.enText || <span style={{ color: '#B5BBC4', fontStyle: 'italic' }}>No translation</span>}
                  {translation.confidence === 'low' && (
                    <span title="Low confidence" style={{ marginLeft: 4, color: '#B8842A', fontSize: 11 }}>~</span>
                  )}
                </p>
                {onTranslationEdit && (
                  <span className="absolute top-0 right-0 opacity-0 group-hover/en:opacity-100 transition-opacity text-xs" style={{ color: '#8A929C' }}>
                    click to edit
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
        /* Side-by-side: Telugu | English */
        <div className="grid grid-cols-2 gap-3 mt-0.5">
          {/* Left: original */}
          <div
            className="rounded-lg px-2.5 py-2"
            style={{ background: '#F5F1E9', borderLeft: '2px solid #DDD4C2' }}
          >
            {editing ? (
              <textarea
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setEditValue(seg.text) } }}
                autoFocus
                rows={Math.max(2, editValue.split('\n').length)}
                className="w-full resize-none outline-none"
                style={{ fontFamily: "'Noto Sans Telugu','Noto Sans',var(--font-sans),sans-serif", fontSize: 13, lineHeight: 1.6, color: '#1A1F2C', background: 'transparent' }}
              />
            ) : (
              <p
                ref={textRef}
                onMouseUp={handleMouseUp}
                style={{ fontFamily: "'Noto Sans Telugu','Noto Sans',var(--font-sans),sans-serif", fontSize: 13, lineHeight: 1.6, color: '#4A5263', userSelect: onTextSelect ? 'text' : undefined }}
              >
                {seg.text}
              </p>
            )}
          </div>
          {/* Right: English translation (editable) */}
          <div
            className="rounded-lg px-2.5 py-2 group/en"
            style={{ background: '#F0F7F7', borderLeft: '2px solid #0E5C5C40', cursor: editingEn ? 'default' : 'text' }}
            onClick={() => { if (!editingEn && onTranslationEdit) setEditingEn(true) }}
          >
            {editingEn ? (
              <textarea
                value={enValue}
                onChange={e => setEnValue(e.target.value)}
                onBlur={() => {
                  setEditingEn(false)
                  const trimmed = enValue.trim()
                  if (trimmed !== (translation?.enText ?? '')) onTranslationEdit?.(idx, trimmed)
                }}
                onKeyDown={e => { if (e.key === 'Escape') { setEditingEn(false); setEnValue(translation?.enText ?? '') } }}
                autoFocus
                rows={Math.max(2, enValue.split('\n').length)}
                className="w-full resize-none outline-none"
                style={{ fontSize: 13, lineHeight: 1.6, color: '#1A1F2C', background: 'transparent' }}
              />
            ) : (
              <div className="relative">
                <p style={{ fontSize: 13, lineHeight: 1.6, color: '#0E5C5C' }}>
                  {translation.enText || <span style={{ color: '#B5BBC4', fontStyle: 'italic' }}>No translation</span>}
                  {translation.confidence === 'low' && (
                    <span title="Low confidence" style={{ marginLeft: 4, color: '#B8842A', fontSize: 11 }}>~</span>
                  )}
                </p>
                {onTranslationEdit && (
                  <span
                    className="absolute top-0 right-0 opacity-0 group-hover/en:opacity-100 transition-opacity text-xs"
                    style={{ color: '#8A929C' }}
                  >
                    click to edit
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        )
      ) : (
        /* Normal single-column view */
        editing ? (
          <textarea
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setEditValue(seg.text) } }}
            autoFocus
            rows={Math.max(2, editValue.split('\n').length)}
            className="w-full rounded-lg px-2 py-1.5 resize-none"
            style={{ fontFamily: "'Noto Sans Telugu','Noto Sans',var(--font-sans),sans-serif", fontSize: 14, lineHeight: 1.65, color: '#1A1F2C', background: '#FFF8E8', border: '1px solid #B8842A', outline: 'none' }}
          />
        ) : (
          <p
            ref={textRef}
            onMouseUp={handleMouseUp}
            style={{ fontFamily: "'Noto Sans Telugu','Noto Sans',var(--font-sans),sans-serif", fontSize: 14, lineHeight: 1.65, color: isActive ? '#1A1F2C' : '#4A5263', userSelect: onTextSelect ? 'text' : undefined }}
          >
            {seg.text}
          </p>
        )
      )}
    </div>
  )
}

export default function SegmentList({
  segments,
  currentTime,
  onSeek,
  speakerMap,
  onUpdateSpeaker,
  onTextSelect,
  onEditSave,
  onTranslationEdit,
  onHide,
  onUnhide,
  markers = [],
  translationSegments,
  showTranslation,
  hideSource,
}: Props) {
  const [autoScroll, setAutoScroll] = useState(true)
  const [showHidden, setShowHidden] = useState(false)
  const activeRef = useRef<HTMLDivElement | null>(null)

  const hiddenCount = segments.filter(s => s.hidden).length
  const visibleSegments = showHidden ? segments : segments.filter(s => !s.hidden)
  const speakerOrder = buildSpeakerIndex(segments)
  const activeIdx = visibleSegments.findLastIndex(s => currentTime >= s.start)

  useEffect(() => {
    if (!autoScroll || !activeRef.current) return
    activeRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIdx, autoScroll])

  const translationMap = Object.fromEntries(
    (translationSegments ?? []).map(t => [t.segmentIdx, t])
  )

  const wordCount = visibleSegments.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0)

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
          <strong style={{ color: '#1A1F2C' }}>{visibleSegments.length}</strong> segments ·{' '}
          <strong style={{ color: '#1A1F2C' }}>{wordCount.toLocaleString()}</strong> words
        </span>

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

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden(v => !v)}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-all"
              style={{
                border: `1px solid ${showHidden ? '#B8456D' : '#ECE6D9'}`,
                background: showHidden ? '#FDF0F4' : '#FFFFFF',
                color: showHidden ? '#B8456D' : '#8A929C',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                {showHidden
                  ? <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.2" />//eye open
                  : <><path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.2" /><path d="M2 2l8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></>
                }
              </svg>
              {hiddenCount} hidden
            </button>
          )}
          <button
            onClick={() => setAutoScroll(v => !v)}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-all"
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
      </div>

      {/* Segments */}
      <div className="flex-1 overflow-y-auto">
        {visibleSegments.map((seg, visibleIdx) => {
          // visibleIdx is position in filtered list; we need the true idx for actions
          const trueIdx = segments.indexOf(seg)
          const isActive = visibleIdx === activeIdx
          const color = speakerColor(seg.speaker, speakerOrder)
          const label = speakerLabel(seg.speaker, speakerMap)
          const segmentMarkers = markers.filter(m => m.segmentIdx === trueIdx)

          return (
            <SegmentRow
              key={trueIdx}
              seg={seg}
              idx={trueIdx}
              isActive={isActive}
              color={color}
              label={label}
              translation={translationMap[trueIdx]}
              showTranslation={showTranslation}
              hideSource={hideSource}
              segmentMarkers={segmentMarkers}
              onSeek={onSeek}
              onTextSelect={onTextSelect}
              onEditSave={onEditSave}
              onTranslationEdit={onTranslationEdit}
              onHide={onHide}
              onUnhide={onUnhide}
              activeRef={(el) => {
                if (isActive) activeRef.current = el
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
