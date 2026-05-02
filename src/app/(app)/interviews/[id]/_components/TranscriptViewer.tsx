'use client'

import { useState, useCallback } from 'react'
import AudioPlayer from './AudioPlayer'
import SegmentList from './SegmentList'
import type { TranscriptSegment } from '@/types/database'

type Props = {
  audioUrl: string
  segments: TranscriptSegment[]
}

export default function TranscriptViewer({ audioUrl, segments }: Props) {
  const [currentTime, setCurrentTime] = useState(0)
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined)
  const [seekCounter, setSeekCounter] = useState(0) // force update even if same time

  const handleSeek = useCallback((seconds: number) => {
    setSeekTo(seconds)
    setSeekCounter(c => c + 1)
  }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-[14px] overflow-hidden" style={{ border: '1px solid #ECE6D9' }}>
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
          // Pass a compound signal so seekTo triggers even for the same timestamp
          seekTo={seekCounter > 0 ? seekTo : undefined}
        />
      </div>

      {/* Transcript pane */}
      <div
        className="flex flex-col"
        style={{ background: '#FFFFFF', maxHeight: 620, minHeight: 400 }}
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
          />
        </div>
      </div>
    </div>
  )
}
