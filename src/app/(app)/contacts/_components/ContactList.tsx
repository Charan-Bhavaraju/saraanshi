import type { Contact, ContactStatus } from '@/types/database'
import ContactCard from './ContactCard'

const STATUS_ORDER: ContactStatus[] = [
  'lead', 'contacted', 'interested', 'scheduled',
  'interviewed', 'declined', 'done',
]

const STATUS_LABELS: Record<ContactStatus, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  interested: 'Interested',
  scheduled: 'Scheduled',
  interviewed: 'Interviewed',
  declined: 'Declined',
  done: 'Done',
}

export default function ContactList({ contacts }: { contacts: Contact[] }) {
  const byStatus: Partial<Record<ContactStatus, Contact[]>> = {}
  for (const c of contacts) {
    if (!byStatus[c.status]) byStatus[c.status] = []
    byStatus[c.status]!.push(c)
  }

  const groups = STATUS_ORDER.filter(s => (byStatus[s]?.length ?? 0) > 0)

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <p className="text-sm font-medium" style={{ color: '#4A5263' }}>
          No contacts yet
        </p>
        <p className="text-xs" style={{ color: '#8A929C' }}>
          Add your first contact to start building your pipeline.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(status => (
        <div key={status}>
          <div
            className="flex items-baseline gap-3 pb-2.5 mb-3"
            style={{ borderBottom: '1px solid #ECE6D9' }}
          >
            <h3
              className="text-lg"
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {STATUS_LABELS[status]}
            </h3>
            <span className="text-xs" style={{ color: '#8A929C' }}>
              {byStatus[status]!.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {byStatus[status]!.map(c => (
              <ContactCard key={c.id} contact={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
