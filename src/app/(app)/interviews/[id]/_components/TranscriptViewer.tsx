'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import SegmentList from './SegmentList'
import { updateSpeakerMap } from '@/app/(app)/interviews/actions'
import type { TranscriptSegment } from '@/types/database'

// Deferred: WaveSurfer (~350 KB) is only downloaded when a transcript + audio are present.
// ssr:false because WaveSurfer uses AudioContext and other browser-only APIs.
const AudioPlayer = dynamic(() => import('./AudioPlayer'), { ssr: false })

type Props = {
  interviewId: string
  audioUrl: string
  segments: TranscriptSegment[]
  initialSpeakerMap: Record<string, string>
}

export default function TranscriptViewer({ interviewId, audioUrl, segments, initialSpeakerMap }: Props) {
  const [currentTime, setCurrentTime] = useState(0)
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined)
  const [seekCounter, setSeekCounter] = useState(0)
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>(initialSpeakerMap)

  const handleSeek = useCallback((seconds: number) => {
    setSeekTo(seconds)
    setSeekCounter(c => c + 1)
  }, [])

  const handleUpdateSpeaker = useCallback(async (speakerId: string, label: string) => {
    const next = { ...speakerMap, [speakerId]: label }
    setSpeakerMap(next) // optimistic
    await updateSpeakerMap(interviewId, next)
  }, [interviewId, speakerMap])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_1.5fr_1fr] gap-0 rounded-[14px] overflow-hidden" style={{ border: '1px solid #ECE6D9' }}>
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
          seekTo={seekCounter > 0 ? seekTo : undefined}
        />
      </div>

      {/* Transcript pane */}
      <div
        className="flex flex-col"
        style={{ background: '#FFFFFF', maxHeight: 620, minHeight: 400, borderRight: '1px solid #ECE6D9' }}
      >
        <div className="px-5 pt-5 pb-0">
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}
          >
            Transcript
          </h3>
        </div>
        <div className="flex-1 overflow-hidden px-5 pb-5">
          <SegmentList
            segments={segments}
            currentTime={currentTime}
            onSeek={handleSeek}
            speakerMap={speakerMap}
            onUpdateSpeaker={handleUpdateSpeaker}
          />
        </div>
      </div>

      {/* Markers pane — Phase 3 */}
      <div
        className="hidden xl:flex flex-col p-5"
        style={{ background: '#FDFCF9', maxHeight: 620, minHeight: 400 }}
      >
        <h3
          className="text-sm font-medium mb-4"
          style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}
        >
          Markers
        </h3>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M6 8h16M6 14h10M6 20h7" stroke="#DDD4C2" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-xs" style={{ color: '#C5BBAD' }}>
            Tag themes and<br />key moments here
          </p>
        </div>
      </div>
    </div>
  )
}
