'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createInterview, suggestParticipantCode } from '../../actions'
import type { InterviewType } from '@/types/database'

type ContactOption = {
  id: string
  displayName: string
  organization: string | null
  type: string
}

const TYPE_OPTIONS: { value: InterviewType; label: string }[] = [
  { value: 'patient', label: 'Patient' },
  { value: 'doctor', label: 'Doctor / Clinician' },
  { value: 'other', label: 'Other (admin, gatekeeper…)' },
]

const LANG_OPTIONS = [
  { value: 'te' as const, label: 'Telugu' },
  { value: 'en' as const, label: 'English' },
  { value: 'mixed' as const, label: 'Mixed (code-switched)' },
]

export default function NewInterviewForm({ contacts }: { contacts: ContactOption[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [type, setType] = useState<InterviewType>('patient')
  const [contactId, setContactId] = useState('')
  const [participantCode, setParticipantCode] = useState('')
  const [language, setLanguage] = useState<'en' | 'te' | 'mixed'>('mixed')
  const [conductedAt, setConductedAt] = useState(() => {
    const now = new Date()
    now.setMinutes(0, 0, 0)
    return now.toISOString().slice(0, 16) // datetime-local format
  })
  const [location, setLocation] = useState('')
  const [contextNotes, setContextNotes] = useState('')
  const [consentRecorded, setConsentRecorded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-suggest participant code when type changes
  useEffect(() => {
    suggestParticipantCode(type).then(setParticipantCode)
  }, [type])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const interview = await createInterview({
          contactId: contactId || null,
          type,
          participantCode: participantCode || null,
          conductedAt: conductedAt ? new Date(conductedAt).toISOString() : null,
          location: location || null,
          language,
          contextNotes: contextNotes || null,
          consentRecordedAt: consentRecorded ? new Date().toISOString() : null,
        })
        router.push(`/interviews/${interview.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Interview type */}
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: '#4A5263' }}>
          Interview type
        </label>
        <div className="flex gap-2 flex-wrap">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                border: `1px solid ${type === opt.value ? '#0E5C5C' : '#ECE6D9'}`,
                background: type === opt.value ? '#E2EEEC' : '#FFFFFF',
                color: type === opt.value ? '#0E5C5C' : '#4A5263',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact link */}
      <Field label="Link to participant">
        <select
          value={contactId}
          onChange={e => setContactId(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#1A1F2C' }}
        >
          <option value="">— no linked contact —</option>
          {contacts.map(c => (
            <option key={c.id} value={c.id}>
              {c.displayName}{c.organization ? ` · ${c.organization}` : ''}
            </option>
          ))}
        </select>
      </Field>

      {/* Two columns: code + language */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Participant code">
          <input
            type="text"
            value={participantCode}
            onChange={e => setParticipantCode(e.target.value.toUpperCase())}
            placeholder="P-001"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              border: '1px solid #ECE6D9',
              background: '#FFFFFF',
              color: '#1A1F2C',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </Field>

        <Field label="Language">
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as typeof language)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#1A1F2C' }}
          >
            {LANG_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Date + location */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Conducted at">
          <input
            type="datetime-local"
            value={conductedAt}
            onChange={e => setConductedAt(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#1A1F2C' }}
          />
        </Field>

        <Field label="Location (optional)">
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Apollo Jubilee Hills"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#1A1F2C' }}
          />
        </Field>
      </div>

      {/* Context notes */}
      <Field label="Context notes (optional)">
        <textarea
          value={contextNotes}
          onChange={e => setContextNotes(e.target.value)}
          placeholder="Husband present. Quiet voice. Cried at Q15."
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
          style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#1A1F2C', lineHeight: 1.6 }}
        />
      </Field>

      {/* Consent recorded */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setConsentRecorded(v => !v)}
          className="shrink-0 rounded flex items-center justify-center transition-all"
          style={{
            width: 18, height: 18,
            border: consentRecorded ? 'none' : '1.5px solid #B5BBC4',
            background: consentRecorded ? '#0E5C5C' : 'transparent',
            cursor: 'pointer',
          }}
        >
          {consentRecorded && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="text-sm" style={{ color: '#4A5263' }}>
          Verbal consent recorded at time of interview
        </span>
      </label>

      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#FDF0F4', color: '#B8456D', border: '1px solid #F0C8D4' }}>
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#4A5263' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60 transition-opacity"
          style={{ background: '#0E5C5C', color: '#FFFFFF', border: '1px solid #0E5C5C' }}
        >
          {isPending ? 'Creating…' : 'Create interview →'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#4A5263' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
