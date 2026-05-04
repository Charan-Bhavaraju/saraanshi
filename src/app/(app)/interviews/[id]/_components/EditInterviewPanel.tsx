'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateInterview } from '@/app/(app)/interviews/actions'
import ErrorBanner from '@/components/ErrorBanner'
import type { Interview, InterviewType } from '@/types/database'

type ContactOption = { id: string; displayName: string; organization: string | null }

type Props = {
  interview: Interview
  contacts: ContactOption[]
}

const TYPE_OPTIONS: { value: InterviewType; label: string }[] = [
  { value: 'patient', label: 'Patient' },
  { value: 'doctor', label: 'Doctor / Clinician' },
  { value: 'other', label: 'Other' },
]

const LANG_OPTIONS = [
  { value: 'te' as const, label: 'Telugu' },
  { value: 'en' as const, label: 'English' },
  { value: 'mixed' as const, label: 'Mixed (code-switched)' },
]

function toDatetimeLocal(d: Date | string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 16)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#4A5263' }}>{label}</label>
      {children}
    </div>
  )
}

export default function EditInterviewPanel({ interview, contacts }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [type, setType] = useState<InterviewType>(interview.type)
  const [contactId, setContactId] = useState(interview.contactId ?? '')
  const [participantCode, setParticipantCode] = useState(interview.participantCode ?? '')
  const [language, setLanguage] = useState(interview.language)
  const [conductedAt, setConductedAt] = useState(() => toDatetimeLocal(interview.conductedAt))
  const [location, setLocation] = useState(interview.location ?? '')
  const [contextNotes, setContextNotes] = useState(interview.contextNotes ?? '')
  const [consentRecorded, setConsentRecorded] = useState(!!interview.consentRecordedAt)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await updateInterview({
          id: interview.id,
          type,
          contactId: contactId || null,
          participantCode: participantCode || null,
          conductedAt: conductedAt ? new Date(conductedAt).toISOString() : null,
          location: location || null,
          language,
          contextNotes: contextNotes || null,
          consentRecordedAt: consentRecorded
            ? (interview.consentRecordedAt ? new Date(interview.consentRecordedAt).toISOString() : new Date().toISOString())
            : null,
        })
        router.refresh()
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  return (
    <>
      {/* Trigger button — lives in the header row's right slot */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all shrink-0"
        style={{
          border: `1px solid ${open ? '#0E5C5C' : '#ECE6D9'}`,
          background: open ? '#E2EEEC' : '#FFFFFF',
          color: open ? '#0E5C5C' : '#4A5263',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {open ? 'Cancel edit' : 'Edit details'}
      </button>

      {/* Form panel — basis-full forces a new row inside the flex-wrap header */}
      {open && (
        <div
          className="basis-full rounded-[14px] p-6 mt-2"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
        >
          <h2
            className="text-base mb-5"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em', color: '#1A1F2C' }}
          >
            Edit interview details
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Type */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#4A5263' }}>Interview type</label>
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

            {/* Contact */}
            <Field label="Linked participant">
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

            {/* Code + Language */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Participant code">
                <input
                  type="text"
                  value={participantCode}
                  onChange={e => setParticipantCode(e.target.value.toUpperCase())}
                  placeholder="P-001"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#1A1F2C', fontFamily: 'var(--font-mono)' }}
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

            {/* Date + Location */}
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

            {/* Consent */}
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
              <span className="text-sm" style={{ color: '#4A5263' }}>Verbal consent recorded at time of interview</span>
            </label>

            {error && (
              <ErrorBanner message={error} onDismiss={() => setError(null)} />
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#4A5263' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60 transition-opacity"
                style={{ background: '#0E5C5C', color: '#FFFFFF', border: 'none' }}
              >
                {isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
