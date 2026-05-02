import { db } from '@/db'
import { contacts } from '@/db/schema'
import { isNull, desc } from 'drizzle-orm'
import NewInterviewForm from './_components/NewInterviewForm'

export const dynamic = 'force-dynamic'

async function getContacts() {
  return db
    .select({
      id: contacts.id,
      displayName: contacts.displayName,
      organization: contacts.organization,
      type: contacts.type,
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(desc(contacts.createdAt))
}

export default async function NewInterviewPage() {
  const contactList = await getContacts()

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-20">
      <div className="mb-8">
        <h1
          className="text-3xl tracking-tight"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }}
        >
          New interview
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: '#8A929C' }}>
          Create a record before or after the conversation. Audio upload is the next step.
        </p>
      </div>

      <NewInterviewForm contacts={contactList} />
    </div>
  )
}
