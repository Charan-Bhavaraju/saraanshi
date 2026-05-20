'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markReviewed } from '@/app/(app)/interviews/actions'
import ExportMenu from './ExportMenu'
import type { InterviewStatus } from '@/types/database'

type Props = {
  interviewId: string
  transcriptId: string
  interviewStatus: InterviewStatus
  hasTranslation: boolean
  showTranslation: boolean
  onToggleTranslation: () => void
  onTranslate: () => void
  isTranslating: boolean
  onExpand?: () => void
  expanded?: boolean
  onCollapse?: () => void
  hideSource?: boolean
  onToggleHideSource?: () => void
  currentTime?: number
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function EditorBar({
  interviewId,
  transcriptId,
  interviewStatus,
  hasTranslation,
  showTranslation,
  onToggleTranslation,
  onTranslate,
  isTranslating,
  onExpand,
  expanded,
  onCollapse,
  hideSource,
  onToggleHideSource,
  currentTime,
}: Props) {
  const router = useRouter()
  const [marking, setMarking] = useState(false)
  const isReviewed = ['reviewed', 'analyzed'].includes(interviewStatus)
  void transcriptId

  async function handleMarkReviewed() {
    setMarking(true)
    try {
      await markReviewed(interviewId)
      router.refresh()
    } finally {
      setMarking(false)
    }
  }

  return (
    <div
      className="flex items-center gap-2 px-5 py-2.5 flex-wrap"
      style={{ borderBottom: '1px solid #ECE6D9', background: '#FDFCF9' }}
    >
      {/* Translation toggle */}
      <button
        onClick={onToggleTranslation}
        disabled={!hasTranslation}
        title={hasTranslation ? 'Toggle English translation' : 'No translation yet — click Translate'}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
        style={{
          border: `1px solid ${showTranslation ? '#0E5C5C' : '#ECE6D9'}`,
          background: showTranslation ? '#E2EEEC' : '#FFFFFF',
          color: showTranslation ? '#0E5C5C' : '#4A5263',
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
        }}
      >
        EN
      </button>

      {/* Source toggle — hide/show original column when translation visible */}
      {hasTranslation && showTranslation && (
        <button
          onClick={onToggleHideSource}
          title={hideSource ? 'Show original text alongside translation' : 'Hide original — show English only'}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
          style={{
            border: `1px solid ${hideSource ? '#B8842A' : '#ECE6D9'}`,
            background: hideSource ? '#FFF3E0' : '#FFFFFF',
            color: hideSource ? '#B8842A' : '#4A5263',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            {hideSource ? (
              <>
                <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2 2l8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </>
            ) : (
              <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4zM6 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" stroke="currentColor" strokeWidth="1.2" />
            )}
          </svg>
          {hideSource ? 'EN only' : 'Source'}
        </button>
      )}

      {/* Translate button */}
      {!hasTranslation && (
        <button
          onClick={onTranslate}
          disabled={isTranslating}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-60"
          style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#4A5263' }}
        >
          {isTranslating ? (
            <>
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
                <path d="M6 2a4 4 0 0 1 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Translating…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 3h5M3 1v2M2 5c0 2 1.5 3.5 3 4M7 3c0 2 1.5 3.5 3 4M7 11l3-8 3 8M8.5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Translate
            </>
          )}
        </button>
      )}

      <div className="flex-1" />

      {/* Playback time in focus mode */}
      {expanded && currentTime !== undefined && (
        <span
          className="text-xs px-2 py-1 rounded"
          style={{ fontFamily: 'var(--font-mono)', color: '#8A929C', background: '#F5F1E9', fontSize: 11 }}
        >
          {formatTime(currentTime)}
        </span>
      )}

      {/* Mark reviewed */}
      {isReviewed ? (
        <span
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
          style={{ background: '#E0E5DA', color: '#4A5C3A', fontWeight: 500 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Reviewed
        </span>
      ) : (
        <button
          onClick={handleMarkReviewed}
          disabled={marking}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-60"
          style={{ border: '1px solid #DDD4C2', background: '#FFFFFF', color: '#4A5263' }}
        >
          {marking ? (
            <>
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
                <path d="M6 2a4 4 0 0 1 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Saving…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Mark reviewed
            </>
          )}
        </button>
      )}

      <ExportMenu interviewId={interviewId} hasTranslation={hasTranslation} />

      {/* Focus / Exit focus */}
      {!expanded && onExpand && (
        <button
          onClick={onExpand}
          title="Focus mode — full screen editor (Esc to exit)"
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
          style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#4A5263' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 4.5V1.5h3M7.5 1.5h3v3M11 7.5v3H8M4.5 11H1.5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Focus
        </button>
      )}
      {expanded && onCollapse && (
        <button
          onClick={onCollapse}
          title="Exit focus mode (Esc)"
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
          style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#4A5263' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 1.5H1.5V4M8 1.5h2.5V4M1.5 8V10.5H4M8 10.5h2.5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Exit focus
        </button>
      )}
    </div>
  )
}
