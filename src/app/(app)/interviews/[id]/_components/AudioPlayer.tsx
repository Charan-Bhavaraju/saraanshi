'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'

type Props = {
  audioUrl: string
  onTimeUpdate?: (currentTime: number) => void
  seekTo?: number   // time in seconds to seek to
  seekCounter?: number // increment to re-seek even if seekTo value is the same
}

const SPEEDS = [1, 1.25, 1.5, 2] as const

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function AudioPlayer({ audioUrl, onTimeUpdate, seekTo, seekCounter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedIdx, setSpeedIdx] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Init wavesurfer
  useEffect(() => {
    if (!containerRef.current) return

    const ws = WaveSurfer.create({
      container: containerRef.current,
      // Thin bar waveform matching the mockup: teal played + rose unplayed
      waveColor: '#B8456D',
      progressColor: '#0E5C5C',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 64,
      normalize: true,
      interact: true,
      url: audioUrl,
    })

    ws.on('ready', (dur) => {
      setDuration(dur)
      setIsReady(true)
    })

    ws.on('audioprocess', (t) => {
      setCurrentTime(t)
      onTimeUpdate?.(t)
    })

    ws.on('seeking', (t) => {
      setCurrentTime(t)
      onTimeUpdate?.(t)
    })

    ws.on('finish', () => setIsPlaying(false))
    ws.on('error', () => setLoadError(true))
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))

    wsRef.current = ws

    return () => { ws.destroy(); wsRef.current = null }
  }, [audioUrl]) // re-init if URL changes (presign refresh)

  // Seek from external (segment click). seekCounter as dep so clicking
  // the same segment twice still fires.
  useEffect(() => {
    if (seekTo === undefined || !wsRef.current || !isReady) return
    wsRef.current.seekTo(seekTo / wsRef.current.getDuration())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTo, seekCounter, isReady])

  function togglePlay() {
    wsRef.current?.playPause()
  }

  function skip(seconds: number) {
    if (!wsRef.current) return
    wsRef.current.setTime(Math.max(0, Math.min(currentTime + seconds, duration)))
  }

  function cycleSpeed() {
    const next = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(next)
    wsRef.current?.setPlaybackRate(SPEEDS[next])
  }

  // Keyboard shortcuts: Space, ←, →
  // Uses refs so the handler is stable — deps array left empty intentionally.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); wsRef.current?.playPause() }
      if (e.code === 'ArrowLeft') { e.preventDefault(); wsRef.current?.setTime(Math.max(0, (wsRef.current.getCurrentTime() - 5))) }
      if (e.code === 'ArrowRight') { e.preventDefault(); wsRef.current?.setTime(Math.min(wsRef.current.getDuration(), wsRef.current.getCurrentTime() + 5)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // stable: reads from wsRef directly, no stale closure risk

  if (loadError) {
    return (
      <div
        className="rounded-xl p-4 text-sm text-center"
        style={{ background: '#FDF0F4', color: '#B8456D', border: '1px solid #F0C8D4' }}
      >
        Could not load audio. The playback link may have expired — reload the page.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Waveform */}
      <div
        className="rounded-xl p-4"
        style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
      >
        {!isReady && (
          <div
            className="rounded animate-pulse"
            style={{ height: 64, background: '#F5F1E9' }}
          />
        )}
        <div
          ref={containerRef}
          style={{ display: isReady ? 'block' : 'none' }}
        />
        <div className="flex justify-between mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8A929C' }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {/* Skip back 5s */}
        <button
          onClick={() => skip(-5)}
          disabled={!isReady}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
          style={{
            border: '1px solid #ECE6D9',
            background: '#FFFFFF',
            color: '#4A5263',
            fontFamily: 'var(--font-mono)',
          }}
          title="Skip back 5s (←)"
        >
          −5s
        </button>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="flex items-center justify-center rounded-full transition-all disabled:opacity-40"
          style={{ width: 48, height: 48, background: '#1A1F2C', color: '#FAF7F2', border: 'none', cursor: 'pointer' }}
          title="Play / Pause (Space)"
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2.5l10 5.5-10 5.5V2.5z" />
            </svg>
          )}
        </button>

        {/* Skip forward 5s */}
        <button
          onClick={() => skip(5)}
          disabled={!isReady}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
          style={{
            border: '1px solid #ECE6D9',
            background: '#FFFFFF',
            color: '#4A5263',
            fontFamily: 'var(--font-mono)',
          }}
          title="Skip forward 5s (→)"
        >
          +5s
        </button>

        {/* Speed */}
        <button
          onClick={cycleSpeed}
          disabled={!isReady}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
          style={{
            border: `1px solid ${speedIdx > 0 ? '#B2D8D4' : '#ECE6D9'}`,
            background: speedIdx > 0 ? '#E2EEEC' : '#FFFFFF',
            color: speedIdx > 0 ? '#0E5C5C' : '#4A5263',
            fontFamily: 'var(--font-mono)',
            minWidth: 52,
          }}
          title="Change playback speed"
        >
          {SPEEDS[speedIdx]}× ▾
        </button>
      </div>

      {/* Keyboard hint */}
      <div
        className="rounded-lg px-3 py-2.5 text-xs"
        style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#8A929C', lineHeight: 1.8 }}
      >
        <span className="font-medium" style={{ color: '#4A5263', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
          Shortcuts
        </span>
        <div className="mt-1 grid grid-cols-2 gap-x-4">
          <KbdRow kbd="Space" label="Play / pause" />
          <KbdRow kbd="←" label="Back 5s" />
          <KbdRow kbd="→" label="Forward 5s" />
          <KbdRow kbd="Click segment" label="Seek" />
        </div>
      </div>
    </div>
  )
}

function KbdRow({ kbd, label }: { kbd: string; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <kbd
        className="inline-block rounded"
        style={{
          padding: '1px 5px',
          background: '#F5F1E9',
          border: '1px solid #ECE6D9',
          borderBottom: '2px solid #DDD4C2',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: '#4A5263',
        }}
      >
        {kbd}
      </kbd>
      <span>{label}</span>
    </div>
  )
}
