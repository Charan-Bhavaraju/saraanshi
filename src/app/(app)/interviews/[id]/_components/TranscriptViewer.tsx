'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import SegmentList from './SegmentList'
import MarkersList from './MarkersList'
import EditorBar from './EditorBar'
import SelectionToolbar, { type SelectionData } from './SelectionToolbar'
import {
  updateSpeakerMap,
  createMarker,
  deleteMarker,
  updateMarkerNote,
  saveSegmentEdit,
  hideSegment,
  setSegmentsHiddenBulk,
  saveTranslation,
} from '@/app/(app)/interviews/actions'
import { isFillerSegment } from '@/lib/fillers'
import type {
  TranscriptSegment,
  TranslationSegment,
  Marker,
  MarkerType,
  InterviewStatus,
} from '@/types/database'

const AudioPlayer = dynamic(() => import('./AudioPlayer'), { ssr: false })

type Props = {
  interviewId: string
  audioUrl: string
  segments: TranscriptSegment[]
  initialSpeakerMap: Record<string, string>
  transcriptId?: string
  initialMarkers?: Marker[]
  initialTranslationSegments?: TranslationSegment[]
  interviewStatus: InterviewStatus
}

export default function TranscriptViewer({
  interviewId,
  audioUrl,
  segments: initialSegments,
  initialSpeakerMap,
  transcriptId,
  initialMarkers = [],
  initialTranslationSegments = [],
  interviewStatus,
}: Props) {
  const [currentTime, setCurrentTime] = useState(0)
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined)
  const [seekCounter, setSeekCounter] = useState(0)
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>(initialSpeakerMap)

  const [localSegments, setLocalSegments] = useState<TranscriptSegment[]>(initialSegments)
  const [localMarkers, setLocalMarkers] = useState<Marker[]>(initialMarkers)
  const [translationSegments, setTranslationSegments] = useState<TranslationSegment[]>(initialTranslationSegments)
  const [showTranslation, setShowTranslation] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)

  const [selectionData, setSelectionData] = useState<SelectionData | null>(null)
  const [savingMarker, setSavingMarker] = useState(false)

  const [undoSegment, setUndoSegment] = useState<{ idx: number; text: string } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [expanded, setExpanded] = useState(false)
  const [hideSource, setHideSource] = useState(false)
  const [isHidingFillers, setIsHidingFillers] = useState(false)

  const fillerCount = useMemo(
    () => localSegments.filter(s => !s.hidden && isFillerSegment(s.text)).length,
    [localSegments],
  )
  const hiddenFillerCount = useMemo(
    () => localSegments.filter(s => s.hidden && isFillerSegment(s.text)).length,
    [localSegments],
  )

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [expanded])

  const handleSeek = useCallback((seconds: number) => {
    setSeekTo(seconds)
    setSeekCounter(c => c + 1)
  }, [])

  const handleUpdateSpeaker = useCallback(async (speakerId: string, label: string) => {
    const next = { ...speakerMap, [speakerId]: label }
    setSpeakerMap(next)
    try {
      await updateSpeakerMap(interviewId, next)
    } catch (e) {
      console.error('updateSpeakerMap failed', e)
    }
  }, [interviewId, speakerMap])

  const handleEditSave = useCallback(async (segmentIdx: number, text: string) => {
    if (!transcriptId) return
    setLocalSegments(prev => prev.map((s, i) =>
      i === segmentIdx
        ? { ...s, text, edited: true, editedByHuman: true, originalText: s.editedByHuman ? s.originalText : s.text }
        : s
    ))
    try {
      await saveSegmentEdit(interviewId, transcriptId, segmentIdx, text)
    } catch (e) {
      console.error('saveSegmentEdit failed', e)
    }
  }, [interviewId, transcriptId])

  const handleTranslationEdit = useCallback(async (segmentIdx: number, enText: string) => {
    if (!transcriptId) return
    const updated = translationSegments.map(t =>
      t.segmentIdx === segmentIdx ? { ...t, enText } : t
    )
    if (!updated.find(t => t.segmentIdx === segmentIdx)) {
      updated.push({ segmentIdx, enText, confidence: 'high' })
    }
    setTranslationSegments(updated)
    try {
      await saveTranslation(transcriptId, interviewId, updated)
    } catch (e) {
      console.error('saveTranslation failed', e)
    }
  }, [transcriptId, interviewId, translationSegments])

  const handleHideSegment = useCallback(async (segmentIdx: number) => {
    if (!transcriptId) return
    const seg = localSegments[segmentIdx]
    if (!seg) return
    setLocalSegments(prev => prev.map((s, i) => i === segmentIdx ? { ...s, hidden: true } : s))
    setUndoSegment({ idx: segmentIdx, text: seg.text })
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndoSegment(null), 5000)
    try {
      await hideSegment(interviewId, transcriptId, segmentIdx, true)
    } catch (e) {
      console.error('hideSegment failed', e)
      // Revert optimistic update on failure
      setLocalSegments(prev => prev.map((s, i) => i === segmentIdx ? { ...s, hidden: false } : s))
      setUndoSegment(null)
    }
  }, [interviewId, transcriptId, localSegments])

  const handleUnhideSegment = useCallback(async (segmentIdx: number) => {
    if (!transcriptId) return
    setLocalSegments(prev => prev.map((s, i) => i === segmentIdx ? { ...s, hidden: false } : s))
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoSegment(null)
    try {
      await hideSegment(interviewId, transcriptId, segmentIdx, false)
    } catch (e) {
      console.error('unhideSegment failed', e)
      // Revert optimistic update on failure
      setLocalSegments(prev => prev.map((s, i) => i === segmentIdx ? { ...s, hidden: true } : s))
    }
  }, [interviewId, transcriptId])

  const handleToggleFillers = useCallback(async () => {
    if (!transcriptId) return
    // If any fillers are visible → hide all. If all are hidden → show all.
    const hiding = fillerCount > 0
    const indices = localSegments
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => hiding ? (!s.hidden && isFillerSegment(s.text)) : (s.hidden && isFillerSegment(s.text)))
      .map(({ i }) => i)
    if (indices.length === 0) return
    setIsHidingFillers(true)
    setLocalSegments(prev => prev.map((s, i) => indices.includes(i) ? { ...s, hidden: hiding } : s))
    try {
      await setSegmentsHiddenBulk(interviewId, transcriptId, indices, hiding)
    } catch (e) {
      console.error('toggleFillers failed', e)
      setLocalSegments(prev => prev.map((s, i) => indices.includes(i) ? { ...s, hidden: !hiding } : s))
    } finally {
      setIsHidingFillers(false)
    }
  }, [interviewId, transcriptId, localSegments, fillerCount])

  const handleCreateMarker = useCallback(async (type: MarkerType) => {
    if (!selectionData || !transcriptId) return
    setSavingMarker(true)
    try {
      const marker = await createMarker({
        interviewId,
        transcriptId,
        segmentIdx: selectionData.segmentIdx,
        excerpt: selectionData.text,
        type,
      })
      if (marker) setLocalMarkers(prev => [...prev, marker])
      window.getSelection()?.removeAllRanges()
      setSelectionData(null)
    } finally {
      setSavingMarker(false)
    }
  }, [selectionData, interviewId, transcriptId])

  const handleDeleteMarker = useCallback(async (markerId: string) => {
    // Optimistic removal
    setLocalMarkers(prev => prev.filter(m => m.id !== markerId))
    await deleteMarker(markerId, interviewId)
  }, [interviewId])

  const handleUpdateMarkerNote = useCallback(async (markerId: string, note: string, tags: string[]) => {
    setLocalMarkers(prev => prev.map(m => m.id === markerId ? { ...m, note, tags } : m))
    await updateMarkerNote(markerId, interviewId, note, tags)
  }, [interviewId])

  const handleTranslate = useCallback(async () => {
    if (!transcriptId) return
    setIsTranslating(true)
    try {
      const res = await fetch(`/api/interviews/${interviewId}/translate`, { method: 'POST' })
      if (!res.ok) throw new Error('Translation failed')
      const { segments: translated }: { segments: TranslationSegment[] } = await res.json()
      setTranslationSegments(translated)
      await saveTranslation(transcriptId, interviewId, translated)
      setShowTranslation(true)
    } catch {
      // fail silently — no ANTHROPIC_API_KEY or quota
    } finally {
      setIsTranslating(false)
    }
  }, [transcriptId, interviewId])

  const hasTranslation = translationSegments.length > 0

  return (
    <>
    <div
      className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_1.5fr_1fr] gap-0 rounded-[14px] overflow-hidden"
      style={{ border: '1px solid #ECE6D9' }}
    >
      {/* Audio pane */}
      <div
        className="p-5 flex flex-col gap-0"
        style={{ background: '#F5F1E9', borderRight: '1px solid #ECE6D9' }}
      >
        <h3
          className="text-sm font-medium mb-4"
          style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}
        >
          Audio
        </h3>
        <AudioPlayer
          audioUrl={audioUrl}
          onTimeUpdate={setCurrentTime}
          seekTo={seekTo}
          seekCounter={seekCounter}
        />
      </div>

      {/* Transcript pane */}
      <div
        className="flex flex-col"
        style={{ background: '#FFFFFF', maxHeight: 680, minHeight: 400, borderRight: '1px solid #ECE6D9' }}
      >
        {/* Editor bar */}
        {transcriptId && (
          <EditorBar
            interviewId={interviewId}
            transcriptId={transcriptId}
            interviewStatus={interviewStatus}
            hasTranslation={hasTranslation}
            showTranslation={showTranslation}
            onToggleTranslation={() => setShowTranslation(v => !v)}
            onTranslate={handleTranslate}
            isTranslating={isTranslating}
            fillerCount={fillerCount}
            hiddenFillerCount={hiddenFillerCount}
            onHideFillers={handleToggleFillers}
            isHidingFillers={isHidingFillers}
            onExpand={() => setExpanded(true)}
          />
        )}
        <div className="px-5 pt-4 pb-0">
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}
          >
            Transcript
          </h3>
        </div>
        <div className="flex-1 overflow-hidden px-5 pb-5 relative">
          <SegmentList
            segments={localSegments}
            currentTime={currentTime}
            onSeek={handleSeek}
            speakerMap={speakerMap}
            onUpdateSpeaker={handleUpdateSpeaker}
            onTextSelect={transcriptId ? setSelectionData : undefined}
            onEditSave={transcriptId ? handleEditSave : undefined}
            onTranslationEdit={transcriptId ? handleTranslationEdit : undefined}
            onHide={transcriptId ? handleHideSegment : undefined}
            onUnhide={transcriptId ? handleUnhideSegment : undefined}
            markers={localMarkers}
            translationSegments={translationSegments}
            showTranslation={showTranslation}
            hideSource={hideSource}
          />
          {/* Undo toast */}
          {undoSegment && (
            <div
              className="absolute bottom-4 left-0 right-0 mx-3 flex items-center gap-3 px-3 py-2.5 rounded-xl shadow-lg"
              style={{ background: '#1A1F2C', border: '1px solid #2D3545' }}
            >
              <p className="flex-1 text-xs truncate" style={{ color: '#B5BBC4' }}>
                Hidden: <span style={{ color: '#FAF7F2' }}>&ldquo;{undoSegment.text}&rdquo;</span>
              </p>
              <button
                onClick={() => handleUnhideSegment(undoSegment.idx)}
                className="text-xs font-medium px-2.5 py-1 rounded-lg shrink-0"
                style={{ background: '#E2EEEC', color: '#0E5C5C' }}
              >
                Undo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Markers pane */}
      <div
        className="hidden xl:flex flex-col p-5"
        style={{ background: '#FDFCF9', maxHeight: 680, minHeight: 400 }}
      >
        <h3
          className="text-sm font-medium mb-4"
          style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}
        >
          Markers
          {localMarkers.length > 0 && (
            <span
              className="ml-2 px-1.5 py-0.5 rounded-full"
              style={{ background: '#F5F1E9', color: '#4A5263', fontSize: 10, fontWeight: 400, verticalAlign: 'middle' }}
            >
              {localMarkers.length}
            </span>
          )}
        </h3>
        <MarkersList
          markers={localMarkers}
          segments={localSegments}
          onDelete={handleDeleteMarker}
          onUpdateNote={handleUpdateMarkerNote}
        />
      </div>

      {/* Selection toolbar — rendered at fixed position in viewport */}
      {selectionData && (
        <SelectionToolbar
          selection={selectionData}
          onSelect={handleCreateMarker}
          onClose={() => setSelectionData(null)}
          saving={savingMarker}
        />
      )}
    </div>

    {/* ── Expanded / focus-mode overlay ── */}
    {expanded && (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#FAF7F2' }}>
        {/* Toolbar */}
        <div style={{ background: '#FFFFFF', borderBottom: '1px solid #ECE6D9', flexShrink: 0 }}>
          <EditorBar
            interviewId={interviewId}
            transcriptId={transcriptId ?? ''}
            interviewStatus={interviewStatus}
            hasTranslation={hasTranslation}
            showTranslation={showTranslation}
            onToggleTranslation={() => setShowTranslation(v => !v)}
            onTranslate={handleTranslate}
            isTranslating={isTranslating}
            fillerCount={fillerCount}
            hiddenFillerCount={hiddenFillerCount}
            onHideFillers={handleToggleFillers}
            isHidingFillers={isHidingFillers}
            expanded={true}
            onCollapse={() => setExpanded(false)}
            hideSource={hideSource}
            onToggleHideSource={() => setHideSource(v => !v)}
            currentTime={currentTime}
          />
        </div>

        {/* Transcript body — document-like layout */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full max-w-4xl mx-auto px-6 pt-3 pb-4 flex flex-col">
            <div className="flex-1 overflow-hidden relative">
              <SegmentList
                segments={localSegments}
                currentTime={currentTime}
                onSeek={handleSeek}
                speakerMap={speakerMap}
                onUpdateSpeaker={handleUpdateSpeaker}
                onTextSelect={transcriptId ? setSelectionData : undefined}
                onEditSave={transcriptId ? handleEditSave : undefined}
                onTranslationEdit={transcriptId ? handleTranslationEdit : undefined}
                onHide={transcriptId ? handleHideSegment : undefined}
                onUnhide={transcriptId ? handleUnhideSegment : undefined}
                markers={localMarkers}
                translationSegments={translationSegments}
                showTranslation={showTranslation}
                hideSource={hideSource}
              />
              {undoSegment && (
                <div
                  className="absolute bottom-4 left-0 right-0 mx-3 flex items-center gap-3 px-3 py-2.5 rounded-xl shadow-lg"
                  style={{ background: '#1A1F2C', border: '1px solid #2D3545' }}
                >
                  <p className="flex-1 text-xs truncate" style={{ color: '#B5BBC4' }}>
                    Hidden: <span style={{ color: '#FAF7F2' }}>&ldquo;{undoSegment.text}&rdquo;</span>
                  </p>
                  <button
                    onClick={() => handleUnhideSegment(undoSegment.idx)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg shrink-0"
                    style={{ background: '#E2EEEC', color: '#0E5C5C' }}
                  >
                    Undo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectionData && (
          <SelectionToolbar
            selection={selectionData}
            onSelect={handleCreateMarker}
            onClose={() => setSelectionData(null)}
            saving={savingMarker}
          />
        )}
      </div>
    )}
    </>
  )
}
