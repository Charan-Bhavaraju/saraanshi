'use client'

import { useState, useRef, useCallback } from 'react'
import { markAudioUploaded } from '../../actions'

type UploadState =
  | { phase: 'idle' }
  | { phase: 'selected'; file: File }
  | { phase: 'uploading'; progress: number; speed: string; eta: string }
  | { phase: 'done'; filename: string }
  | { phase: 'error'; message: string; retryCount: number }

const ACCEPTED = '.m4a,.mp3,.mp4,.wav,.webm,.ogg,.aac'
const MAX_RETRIES = 3

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function formatETA(seconds: number) {
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`
}

export default function UploadZone({
  interviewId,
  participantCode,
  onUploaded,
}: {
  interviewId: string
  participantCode: string | null
  onUploaded?: () => void
}) {
  const [state, setState] = useState<UploadState>({ phase: 'idle' })
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const startTimeRef = useRef<number>(0)

  const upload = useCallback(async (file: File, retryCount = 0) => {
    setState({ phase: 'uploading', progress: 0, speed: '', eta: '' })
    startTimeRef.current = Date.now()

    try {
      // 1. Get presigned PUT URL from our API
      const presignRes = await fetch(
        `/api/r2/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || 'audio/mpeg')}&participantCode=${encodeURIComponent(participantCode ?? 'unknown')}`,
      )
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({ error: 'Failed to get upload URL' }))
        throw new Error(err.error ?? 'Failed to get upload URL')
      }
      const { presignedUrl, r2Key } = await presignRes.json()

      // 2. Upload directly to R2 via XHR (fetch doesn't support upload progress)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return
          const progress = Math.round((e.loaded / e.total) * 100)
          const elapsed = (Date.now() - startTimeRef.current) / 1000
          const speed = elapsed > 0 ? e.loaded / elapsed : 0
          const remaining = speed > 0 ? (e.total - e.loaded) / speed : 0

          setState({
            phase: 'uploading',
            progress,
            speed: speed > 0 ? `${formatBytes(speed)}/s` : '',
            eta: remaining > 0 ? formatETA(remaining) : '',
          })
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed: HTTP ${xhr.status}`))
        }

        xhr.onerror = () => reject(new Error('Network error — check your connection'))
        xhr.ontimeout = () => reject(new Error('Upload timed out'))

        xhr.open('PUT', presignedUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg')
        xhr.timeout = 5 * 60 * 1000 // 5-minute timeout for large files
        xhr.send(file)
      })

      // 3. Mark uploaded in DB via server action
      await markAudioUploaded({
        id: interviewId,
        audioR2Key: r2Key,
        audioSizeBytes: file.size,
        durationSeconds: null, // will be filled after transcription
      })

      setState({ phase: 'done', filename: file.name })
      onUploaded?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'

      if (retryCount < MAX_RETRIES && !message.includes('not allowed')) {
        // Exponential back-off: 2s, 4s, 8s
        const delay = Math.pow(2, retryCount + 1) * 1000
        setState({ phase: 'error', message: `${message} — retrying in ${delay / 1000}s…`, retryCount })
        setTimeout(() => upload(file, retryCount + 1), delay)
      } else {
        setState({ phase: 'error', message, retryCount })
      }
    }
  }, [interviewId, participantCode, onUploaded])

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    setState({ phase: 'selected', file })
    upload(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleCancel() {
    xhrRef.current?.abort()
    setState({ phase: 'idle' })
  }

  const idle = state.phase === 'idle' || (state.phase === 'error' && state.retryCount >= MAX_RETRIES)

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      {(idle || state.phase === 'error') && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-4 rounded-2xl cursor-pointer transition-all"
          style={{
            border: `2px dashed ${isDragging ? '#0E5C5C' : '#DDD4C2'}`,
            background: isDragging ? '#E2EEEC' : '#F5F1E9',
            padding: '48px 24px',
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 52, height: 52, background: isDragging ? '#C5DDD8' : '#ECE6D9' }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 14V4M7 8l4-4 4 4" stroke={isDragging ? '#0E5C5C' : '#8A929C'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 17h14" stroke={isDragging ? '#0E5C5C' : '#B5BBC4'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: isDragging ? '#0E5C5C' : '#4A5263' }}>
              {isDragging ? 'Drop audio file here' : 'Drop audio file or click to browse'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#8A929C' }}>
              M4A, MP3, WAV, MP4, WebM · up to ~200 MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Upload progress */}
      {state.phase === 'uploading' && (
        <div
          className="rounded-2xl p-5"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>Uploading…</p>
            <button
              onClick={handleCancel}
              className="text-xs px-2 py-1 rounded"
              style={{ color: '#8A929C', background: '#F5F1E9' }}
            >
              Cancel
            </button>
          </div>

          {/* Progress bar */}
          <div
            className="rounded-full overflow-hidden mb-2"
            style={{ height: 6, background: '#ECE6D9' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${state.progress}%`, background: '#0E5C5C' }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span
              className="text-xs"
              style={{ fontFamily: 'var(--font-mono)', color: '#8A929C' }}
            >
              {state.progress}%
            </span>
            <span className="text-xs" style={{ color: '#8A929C' }}>
              {state.speed && `${state.speed}`}
              {state.eta && ` · ${state.eta} left`}
            </span>
          </div>
        </div>
      )}

      {/* Done */}
      {state.phase === 'done' && (
        <div
          className="flex items-center gap-3 rounded-2xl p-4"
          style={{ background: '#E2EEEC', border: '1px solid #C5DDD8' }}
        >
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 32, height: 32, background: '#0E5C5C' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7l3 3 6-6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: '#0E5C5C' }}>Upload complete</p>
            <p className="text-xs truncate" style={{ color: '#4A5263' }}>{state.filename}</p>
          </div>
        </div>
      )}

      {/* Error (max retries exhausted) */}
      {state.phase === 'error' && state.retryCount >= MAX_RETRIES && (
        <div
          className="rounded-2xl p-4"
          style={{ background: '#FDF0F4', border: '1px solid #F0C8D4' }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: '#B8456D' }}>Upload failed</p>
          <p className="text-xs mb-3" style={{ color: '#4A5263' }}>{state.message}</p>
          <button
            onClick={() => setState({ phase: 'idle' })}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: '#B8456D', color: '#FFFFFF' }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Auto-retry in progress */}
      {state.phase === 'error' && state.retryCount < MAX_RETRIES && (
        <div
          className="flex items-center gap-2 rounded-2xl p-4"
          style={{ background: '#FDF0F4', border: '1px solid #F0C8D4' }}
        >
          <div
            className="shrink-0 w-4 h-4 rounded-full border-2 animate-spin"
            style={{ borderColor: '#F0C8D4', borderTopColor: '#B8456D' }}
          />
          <p className="text-sm" style={{ color: '#B8456D' }}>{state.message}</p>
        </div>
      )}
    </div>
  )
}
