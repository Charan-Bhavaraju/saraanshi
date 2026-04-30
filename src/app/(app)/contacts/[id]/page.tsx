import { db } from '@/db'
import { contacts } from '@/db/schema'
import { eq, isNull, and } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TypePill from '../_components/TypePill'
import ContactDetailClient from './ContactDetailClient'

async function getContact(id: string) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .limit(1)
  return contact ?? null
}

async function getParent(parentId: string) {
  const [parent] = await db
    .select({
      id: contacts.id,
      displayName: contacts.displayName,
      organization: contacts.organization,
      type: contacts.type,
    })
    .from(contacts)
    .where(eq(contacts.id, parentId))
    .limit(1)
  return parent ?? null
}

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead', contacted: 'Contacted', interested: 'Interested',
  scheduled: 'Scheduled', interviewed: 'Interviewed',
  declined: 'Declined', done: 'Done',
}

const CONSENT_LABELS: Record<string, string> = {
  not_yet: 'Not yet', verbal: 'Verbal', written: 'Written', withdrawn: 'Withdrawn',
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contact = await getContact(id)
  if (!contact) notFound()

  const parent = contact.parentId ? await getParent(contact.parentId) : null

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-20">
      {/* Back */}
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: '#8A929C' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Contacts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TypePill type={contact.type} />
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#F5F1E9', color: '#4A5263' }}
            >
              {STATUS_LABELS[contact.status] ?? contact.status}
            </span>
          </div>
          <h1
            className="text-3xl tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }}
          >
            {contact.displayName}
          </h1>
          {(contact.role || contact.organization) && (
            <p className="text-sm mt-1" style={{ color: '#8A929C' }}>
              {[contact.role, contact.organization].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <ContactDetailClient contact={contact} />
      </div>

      {/* Reach via */}
      {parent && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: '#F5F1E9', border: '1px solid #ECE6D9' }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Reached via
          </p>
          <Link href={`/contacts/${parent.id}`} className="flex items-center gap-2">
            <TypePill type={parent.type} />
            <span className="text-sm font-medium" style={{ color: '#0E5C5C' }}>
              {parent.displayName}
              {parent.organization && ` · ${parent.organization}`}
            </span>
          </Link>
        </div>
      )}

      {/* Contact info grid */}
      <div
        className="rounded-2xl p-5 mb-4"
        style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
      >
        <h2
          className="text-base mb-4"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 500 }}
        >
          Contact details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {contact.phone && (
            <DetailRow label="Phone">
              <a href={`tel:${contact.phone}`} style={{ color: '#0E5C5C' }}>
                {contact.phone}
              </a>
            </DetailRow>
          )}
          {contact.whatsapp && (
            <DetailRow label="WhatsApp">
              <a
                href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#0E5C5C' }}
              >
                {contact.whatsapp}
              </a>
            </DetailRow>
          )}
          {contact.email && (
            <DetailRow label="Email">
              <a href={`mailto:${contact.email}`} style={{ color: '#0E5C5C' }}>
                {contact.email}
              </a>
            </DetailRow>
          )}
          {contact.location && (
            <DetailRow label="Location">{contact.location}</DetailRow>
          )}
          <DetailRow label="Consent">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: contact.consentStatus === 'written'
                  ? '#E2EEEC'
                  : contact.consentStatus === 'verbal'
                  ? '#F5EBD3'
                  : '#F5F1E9',
                color: contact.consentStatus === 'written'
                  ? '#0E5C5C'
                  : contact.consentStatus === 'verbal'
                  ? '#B8842A'
                  : '#4A5263',
              }}
            >
              {CONSENT_LABELS[contact.consentStatus]}
            </span>
          </DetailRow>
          {contact.lastContactAt && (
            <DetailRow label="Last contact">
              {new Date(contact.lastContactAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </DetailRow>
          )}
        </div>

        {/* Real name — reveal on tap */}
        <div
          className="mt-4 pt-4"
          style={{ borderTop: '1px solid #ECE6D9' }}
        >
          <RealNameReveal contactId={contact.id} hasRealName={!!contact.realName} />
        </div>
      </div>

      {/* Tags */}
      {contact.tags && contact.tags.length > 0 && (
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Tags
          </p>
          <div className="flex flex-wrap gap-2">
            {contact.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: '#F5F1E9',
                  color: '#4A5263',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {contact.notes && (
        <div
          className="rounded-2xl p-5"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Notes
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#1A1F2C', whiteSpace: 'pre-wrap' }}>
            {contact.notes}
          </p>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <div className="text-sm" style={{ color: '#1A1F2C' }}>{children}</div>
    </div>
  )
}

function RealNameReveal({
  contactId,
  hasRealName,
}: {
  contactId: string
  hasRealName: boolean
}) {
  if (!hasRealName) {
    return (
      <p className="text-xs" style={{ color: '#B5BBC4' }}>
        No real name stored for this contact.
      </p>
    )
  }

  return (
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Real name
      </p>
      {/* This is a client component to handle the reveal action */}
      <RealNameRevealButton contactId={contactId} />
    </div>
  )
}

// Import at top of file would cause circular issues — inline client boundary instead
import RealNameRevealButton from './RealNameRevealButton'
