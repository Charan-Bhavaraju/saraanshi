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
}: Props) {
  const router = useRouter()
  const [marking, setMarking] = useState(false)
  const isReviewed = ['reviewed', 'analyzed'].includes(interviewStatus)

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

      {/* Translate button */}
      {!hasTranslation && (
        <button
          onClick={onTranslate}
          disabled={isTranslating}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-60"
          style={{
            border: '1px solid #ECE6D9',
            background: '#FFFFFF',
            color: '#4A5263',
          }}
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
          style={{
            border: '1px solid #DDD4C2',
            background: '#FFFFFF',
            color: '#4A5263',
          }}
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
    </div>
  )
}
