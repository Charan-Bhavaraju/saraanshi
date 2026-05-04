'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { InterviewWithContact } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft:        { label: 'Draft',        bg: '#F5F1E9', color: '#8A929C' },
  created:      { label: 'No audio',     bg: '#F5F1E9', color: '#8A929C' },
  uploading:    { label: 'Uploading',    bg: '#F5EBD3', color: '#B8842A' },
  uploaded:     { label: 'Uploaded',     bg: '#F5EBD3', color: '#B8842A' },
  transcribing: { label: 'Transcribing', bg: '#F5EBD3', color: '#B8842A' },
  transcribed:  { label: 'Transcribed',  bg: '#E2EEEC', color: '#0E5C5C' },
  reviewed:     { label: 'Reviewed',     bg: '#E0E5DA', color: '#4A5C3A' },
  analyzed:     { label: 'Analyzed',     bg: '#EFEAF8', color: '#5A3F8F' },
}

const TYPE_PILL: Record<string, { label: string; bg: string; color: string }> = {
  patient: { label: 'Patient', bg: '#FDF0F4', color: '#B8456D' },
  doctor:  { label: 'Doctor',  bg: '#E2EEEC', color: '#0E5C5C' },
  other:   { label: 'Other',   bg: '#F5F1E9', color: '#8A929C' },
}

const LANG_LABELS: Record<string, string> = { en: 'English', te: 'Telugu', mixed: 'Mixed' }

type Filter = 'all' | 'patients' | 'doctors' | 'in_progress' | 'transcribed' | 'reviewed'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'patients', label: 'Patients' },
  { key: 'doctors', label: 'Doctors' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'transcribed', label: 'Transcribed' },
  { key: 'reviewed', label: 'Reviewed' },
]

function matchesFilter(interview: InterviewWithContact, filter: Filter): boolean {
  switch (filter) {
    case 'all': return true
    case 'patients': return interview.type === 'patient'
    case 'doctors': return interview.type === 'doctor'
    case 'in_progress': return ['uploading', 'uploaded', 'transcribing'].includes(interview.status)
    case 'transcribed': return interview.status === 'transcribed'
    case 'reviewed': return ['reviewed', 'analyzed'].includes(interview.status)
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function InterviewListClient({ interviews }: { interviews: InterviewWithContact[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const counts: Record<Filter, number> = {
    all: interviews.length,
    patients: interviews.filter(i => i.type === 'patient').length,
    doctors: interviews.filter(i => i.type === 'doctor').length,
    in_progress: interviews.filter(i => ['uploading', 'uploaded', 'transcribing'].includes(i.status)).length,
    transcribed: interviews.filter(i => i.status === 'transcribed').length,
    reviewed: interviews.filter(i => ['reviewed', 'analyzed'].includes(i.status)).length,
  }

  const filtered = interviews.filter(i => matchesFilter(i, filter))

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-5">
        {FILTERS.map(({ key, label }) => {
          const isActive = filter === key
          const count = counts[key]
          if (count === 0 && key !== 'all') return null
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all"
              style={{
                border: `1px solid ${isActive ? '#0E5C5C' : '#DDD4C2'}`,
                background: isActive ? '#0E5C5C' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#4A5263',
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {label}
              {key !== 'all' && count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    background: isActive ? 'rgba(255,255,255,0.2)' : '#F5F1E9',
                    color: isActive ? '#FFFFFF' : '#8A929C',
                    borderRadius: 10,
                    padding: '0 5px',
                    lineHeight: '16px',
                    display: 'inline-block',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: '#8A929C' }}>
          No interviews match this filter.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(interview => (
            <InterviewRow key={interview.id} interview={interview} />
          ))}
        </div>
      )}
    </div>
  )
}

function InterviewRow({ interview }: { interview: InterviewWithContact }) {
  const cfg = STATUS_CONFIG[interview.status] ?? STATUS_CONFIG.draft
  const typePill = TYPE_PILL[interview.type] ?? TYPE_PILL.other

  return (
    <Link
      href={`/interviews/${interview.id}`}
      className="flex items-center gap-4 px-5 py-4 rounded-[14px] transition-all group hover:bg-[#FAFAF8]"
      style={{ border: '1px solid #ECE6D9' }}
    >
      <div
        className="shrink-0 rounded-lg flex items-center justify-center"
        style={{
          background: '#E2EEEC',
          minWidth: 56,
          height: 40,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 500,
          color: '#0E5C5C',
          padding: '0 8px',
        }}
      >
        {interview.participantCode ?? '—'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>
            {interview.contact?.displayName ?? 'Unknown participant'}
          </p>
          {interview.contact?.organization && (
            <span className="text-xs" style={{ color: '#8A929C' }}>
              · {interview.contact.organization}
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: typePill.bg, color: typePill.color, fontSize: 10, fontWeight: 500 }}
          >
            {typePill.label}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {interview.conductedAt && (
            <span className="text-xs" style={{ color: '#8A929C' }}>{formatDate(interview.conductedAt)}</span>
          )}
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: '#F5F1E9', color: '#4A5263', fontFamily: 'var(--font-mono)', fontSize: 10 }}
          >
            {LANG_LABELS[interview.language]}
          </span>
          {interview.durationSeconds && (
            <span className="text-xs" style={{ color: '#8A929C' }}>{formatDuration(interview.durationSeconds)}</span>
          )}
          {interview.location && (
            <span className="text-xs truncate max-w-[200px]" style={{ color: '#8A929C' }}>
              {interview.location}
            </span>
          )}
        </div>
      </div>

      <span
        className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full uppercase"
        style={{ background: cfg.bg, color: cfg.color, letterSpacing: '0.04em', fontSize: 10 }}
      >
        {cfg.label}
      </span>

      <svg className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 2l5 5-5 5" stroke="#8A929C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}
