import { db } from '@/db'
import { contacts } from '@/db/schema'
import { isNull } from 'drizzle-orm'
import { desc } from 'drizzle-orm'
import ContactsClient from './_components/ContactsClient'
import { headers } from 'next/headers'

async function getContacts() {
  return db
    .select()
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(desc(contacts.createdAt))
}

export default async function ContactsPage() {
  const allContacts = await getContacts()

  // Default to kanban on wide screens, list on narrow — we pass 'list' as
  // default and let the client toggle. The CSS media breakpoint is md (768px).
  const headersList = await headers()
  const ua = headersList.get('user-agent') ?? ''
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua)
  const defaultView = isMobile ? 'list' : 'kanban'

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 pb-20">
      <ContactsClient contacts={allContacts} defaultView={defaultView} />
    </div>
  )
}
