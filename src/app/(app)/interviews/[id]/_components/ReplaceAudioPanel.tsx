'use client'

import { useState } from 'react'
import UploadZone from './UploadZone'

type Props = {
  interviewId: string
  participantCode: string | null
}

export default function ReplaceAudioPanel({ interviewId, participantCode }: Props) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all"
          style={{
            border: '1px solid #ECE6D9',
            background: '#FFFFFF',
            color: '#8A929C',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v4M6 1l-2 2M6 1l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 8v2a1 1 0 001 1h8a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Replace audio
        </button>
      </div>
    )
  }

  return (
    <div
      className="rounded-[14px] p-6 mt-6"
      style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2
            className="text-base mb-1"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Replace audio
          </h2>
          <p className="text-xs" style={{ color: '#8A929C' }}>
            The current transcript will be archived and the interview will return to "Uploaded" so you can re-transcribe.
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="shrink-0 p-1.5 rounded-lg transition-all"
          style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#8A929C' }}
          title="Cancel"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <UploadZone interviewId={interviewId} participantCode={participantCode} />
    </div>
  )
}
