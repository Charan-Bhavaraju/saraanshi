import { db } from '@/db'
import { interviews, contacts, transcripts, markers } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
import StatusBadge from './_components/StatusBadge'
import UploadZone from './_components/UploadZone'
import TranscribeButton from './_components/TranscribeButton'
import TranscriptViewer from './_components/TranscriptViewer'
import RealtimeStatusWatcher from './_components/RealtimeStatusWatcher'
import TranscribingPoller from './_components/TranscribingPoller'
import EditInterviewPanel from './_components/EditInterviewPanel'
import ReplaceAudioPanel from './_components/ReplaceAudioPanel'
import DetailTabs from './_components/DetailTabs'
import { getInsights } from './insights/actions'
import { getObjectives } from './objectives/actions'
import { estimateInsightsPaise } from '@/lib/ai/cost'
import { MODELS } from '@/lib/ai/anthropic'
import type { TranscriptSegment, TranslationSegment, Marker } from '@/types/database'

const LANG_LABELS: Record<string, string> = { en: 'English', te: 'Telugu', hi: 'Hindi', mixed: 'Mixed' }

async function getInterview(id: string) {
  const [row] = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)))
    .limit(1)
  return row ?? null
}

async function getContact(contactId: string) {
  const [c] = await db
    .select({ id: contacts.id, displayName: contacts.displayName, organization: contacts.organization })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1)
  return c ?? null
}

async function getAllContacts() {
  return db
    .select({ id: contacts.id, displayName: contacts.displayName, organization: contacts.organization })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(contacts.displayName)
    .limit(200)
}

async function getCurrentTranscript(interviewId: string) {
  const [t] = await db
    .select()
    .from(transcripts)
    .where(and(eq(transcripts.interviewId, interviewId), eq(transcripts.isCurrent, true)))
    .limit(1)
  return t ?? null
}

async function getMarkers(interviewId: string): Promise<Marker[]> {
  return db
    .select()
    .from(markers)
    .where(and(eq(markers.interviewId, interviewId), isNull(markers.deletedAt)))
    .orderBy(markers.segmentIdx)
}

async function getAudioUrl(interviewId: string): Promise<string | null> {
  // This runs server-side, so we generate the presigned URL here rather than
  // making the client call the API route. This avoids an extra round-trip.
  try {
    const { presignDownload } = await import('@/lib/r2')
    const [row] = await db
      .select({ audioR2Key: interviews.audioR2Key })
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1)

    if (!row?.audioR2Key) return null
    return presignDownload(row.audioR2Key, 3600)
  } catch {
    return null
  }
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDuration(s: number | null | undefined) {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec}s`
}

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const interview = await getInterview(id)
  if (!interview) notFound()

  const [contact, transcript, allContacts, interviewMarkers] = await Promise.all([
    interview.contactId ? getContact(interview.contactId) : null,
    getCurrentTranscript(id),
    getAllContacts(),
    getMarkers(id),
  ])

  // Only fetch audio URL if we have audio and will show the viewer
  const audioUrl = (interview.audioR2Key && transcript)
    ? await getAudioUrl(id)
    : null

  const segments = (transcript?.segments as TranscriptSegment[] | null) ?? []
  const translationSegments = (transcript?.translationSegments as TranslationSegment[] | null) ?? []
  const meta = interview.metadata as { sarvamJobId?: string; speakerMap?: Record<string, string> } | null
  const speakerMap = meta?.speakerMap ?? {}
  const showUploadZone = ['draft', 'created', 'uploading', 'uploaded'].includes(interview.status)
  const showTranscribeButton = interview.status === 'uploaded'
  const showTranscribing = interview.status === 'transcribing'
  const showViewer = ['transcribed', 'reviewed', 'analyzed'].includes(interview.status) && audioUrl && segments.length > 0

  // Insights (Layer 1) become available once the interview is reviewed.
  const insightsEnabled = ['reviewed', 'analyzed'].includes(interview.status) && segments.length > 0
  const [insightsData, objectivesData] = insightsEnabled
    ? await Promise.all([getInsights(id), getObjectives(id)])
    : [null, null]
  const insightsChars = segments.reduce((n, s) => n + (s.hidden ? 0 : (s.text ?? '').length), 0)
  const estimatedPaise = estimateInsightsPaise(MODELS.haiku, Math.ceil(insightsChars / 4) + 600)
  const objectivesEstimatedPaise = estimateInsightsPaise(MODELS.haiku, Math.ceil(insightsChars / 4) + 600, 3500)
  const hasTranslation = translationSegments.length > 0

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-20">
      {/* Realtime: push refresh when status changes */}
      <RealtimeStatusWatcher interviewId={id} currentStatus={interview.status} />

      {/* Back */}
      <Link
        href="/interviews"
        className="inline-flex items-center gap-1.5 text-sm mb-6"
        style={{ color: '#8A929C' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Interviews
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            {interview.participantCode && (
              <span
                className="text-sm font-medium px-2.5 py-1 rounded-lg"
                style={{
                  background: '#E2EEEC',
                  color: '#0E5C5C',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {interview.participantCode}
              </span>
            )}
            <StatusBadge status={interview.status} />
          </div>
          <h1
            className="text-3xl tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }}
          >
            {contact?.displayName ?? 'Unknown participant'}
          </h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {contact?.organization && (
              <span className="text-sm" style={{ color: '#8A929C' }}>{contact.organization}</span>
            )}
            {interview.conductedAt && (
              <span className="text-sm" style={{ color: '#8A929C' }}>{formatDate(interview.conductedAt)}</span>
            )}
            {interview.location && (
              <span className="text-sm" style={{ color: '#8A929C' }}>· {interview.location}</span>
            )}
          </div>
        </div>
        {/* Edit details — basis-full makes the open form break to its own row */}
        <EditInterviewPanel interview={interview} contacts={allContacts} />
      </div>

      {/* Metadata strip */}
      <div
        className="flex gap-6 flex-wrap mb-6 px-5 py-3 rounded-xl"
        style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
      >
        <MetaItem label="Language" value={LANG_LABELS[interview.language] ?? interview.language} />
        {interview.durationSeconds && (
          <MetaItem label="Duration" value={formatDuration(interview.durationSeconds)} />
        )}
        {transcript?.wordCount && (
          <MetaItem label="Words" value={transcript.wordCount.toLocaleString()} />
        )}
        {interview.consentRecordedAt && (
          <MetaItem label="Consent" value="Verbal recorded" teal />
        )}
        {interview.audioSizeBytes && (
          <MetaItem label="File size" value={`${(interview.audioSizeBytes / (1024 * 1024)).toFixed(1)} MB`} />
        )}
      </div>

      {/* Context notes */}
      {interview.contextNotes && (
        <div
          className="rounded-xl px-5 py-4 mb-6"
          style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}
        >
          <p className="text-xs font-medium mb-1 uppercase" style={{ color: '#B8842A', letterSpacing: '0.06em' }}>
            Field notes
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#4A5263' }}>
            {interview.contextNotes}
          </p>
        </div>
      )}

      {/* Upload zone (shown until audio is uploaded) */}
      {showUploadZone && (
        <div
          className="rounded-[14px] p-6 mb-6"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
        >
          <h2
            className="text-lg mb-1"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Upload audio
          </h2>
          <p className="text-xs mb-5" style={{ color: '#8A929C' }}>
            Audio is uploaded directly to secure storage — not through this server. Works on hospital wifi with auto-retry.
          </p>
          <UploadZone
            interviewId={id}
            participantCode={interview.participantCode}
          />
        </div>
      )}

      {/* Transcribe button (shown after upload, before transcription) */}
      {showTranscribeButton && (
        <div
          className="rounded-[14px] p-6 mb-6"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
        >
          <h2
            className="text-lg mb-1"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Transcribe audio
          </h2>
          <p className="text-xs mb-5" style={{ color: '#8A929C' }}>
            Sarvam AI will transcribe with speaker diarization and word-level timestamps.
            Telugu, English, and code-mixed speech are all supported.
          </p>
          <TranscribeButton interviewId={id} />
        </div>
      )}

      {/* Transcribing in-progress state — poller checks Sarvam every 6s */}
      {showTranscribing && (
        <>
          <TranscribingPoller interviewId={id} />
          <div
            className="rounded-[14px] p-6 mb-6 flex items-center gap-4"
            style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
          >
            {/* SVG arc spinner — avoids the CSS border-trick rendering bug */}
            <svg
              className="animate-spin shrink-0"
              width="32" height="32" viewBox="0 0 32 32" fill="none"
              style={{ color: '#B8842A' }}
            >
              <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
              <path d="M16 3a13 13 0 0 1 13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>Transcribing…</p>
              <p className="text-xs mt-0.5" style={{ color: '#8A929C' }}>
                Sarvam is processing the audio. Page will refresh automatically when ready.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Transcript viewer + Insights tab */}
      {showViewer && audioUrl && (
        <DetailTabs
          insightsEnabled={insightsEnabled}
          insightsProps={{
            interviewId: id,
            hasTranslation,
            estimatedPaise,
            initial: insightsData ?? { reflection: null, focusPoints: [] },
          }}
          objectivesProps={{
            interviewId: id,
            hasTranslation,
            estimatedPaise: objectivesEstimatedPaise,
            initial: objectivesData ?? { run: null, findings: [] },
          }}
          transcript={
            <TranscriptViewer
              interviewId={id}
              audioUrl={audioUrl}
              segments={segments}
              initialSpeakerMap={speakerMap}
              transcriptId={transcript?.id}
              initialMarkers={interviewMarkers}
              initialTranslationSegments={translationSegments}
              interviewStatus={interview.status}
            />
          }
        />
      )}

      {/* Replace audio — available for any post-upload status */}
      {['transcribed', 'reviewed', 'analyzed'].includes(interview.status) && (
        <ReplaceAudioPanel interviewId={id} participantCode={interview.participantCode} />
      )}

      {/* Edge case: transcript exists but audio URL failed */}
      {['transcribed', 'reviewed', 'analyzed'].includes(interview.status) && !audioUrl && segments.length > 0 && (
        <div
          className="rounded-[14px] p-6"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
        >
          <p className="text-sm" style={{ color: '#8A929C' }}>
            Could not load audio — reload the page to get a fresh playback link.
          </p>
          <div className="mt-4">
            <h3
              className="text-base mb-3"
              style={{ fontFamily: 'var(--font-serif)', fontWeight: 500 }}
            >
              Transcript ({segments.length} segments)
            </h3>
            {segments.map((seg, i) => (
              <div key={i} className="py-2 text-sm" style={{ borderBottom: '1px solid #ECE6D9', color: '#1A1F2C', lineHeight: 1.65 }}>
                <span className="text-xs mr-2" style={{ color: '#B5BBC4', fontFamily: 'var(--font-mono)' }}>
                  [{Math.floor(seg.start / 60)}:{String(Math.floor(seg.start % 60)).padStart(2, '0')}]
                </span>
                {seg.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetaItem({ label, value, teal }: { label: string; value: string; teal?: boolean }) {
  return (
    <div>
      <p className="text-xs" style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
        {label}
      </p>
      <p className="text-sm font-medium mt-0.5" style={{ color: teal ? '#0E5C5C' : '#1A1F2C' }}>
        {value}
      </p>
    </div>
  )
}
