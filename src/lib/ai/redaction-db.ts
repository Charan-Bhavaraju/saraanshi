import { db } from '@/db'
import { contacts } from '@/db/schema'
import { sql } from 'drizzle-orm'

// Server-side companion to redaction.ts (which is pure). Fetches decrypted real
// names and turns them into redaction entries: the interview's participant →
// their code (e.g. P-007), every other contact → [NAME].

export type ContactRedaction = { realName: string | null; code: string }

// Reads decrypted real names from the pgsodium view, falling back to the
// plaintext column if the view isn't present (pre-migration environments).
export async function getDecryptedContacts(): Promise<Array<{ id: string; realName: string | null }>> {
  try {
    const rows = await db.execute(
      sql`SELECT id, decrypted_real_name AS real_name FROM decrypted_contacts`,
    )
    return (rows as unknown as Array<{ id: string; real_name: string | null }>).map(r => ({
      id: r.id,
      realName: r.real_name,
    }))
  } catch {
    return db.select({ id: contacts.id, realName: contacts.realName }).from(contacts)
  }
}

export async function buildContactRedactionEntries(
  participantContactId: string | null,
  participantCode: string | null,
): Promise<ContactRedaction[]> {
  const decrypted = await getDecryptedContacts()
  return decrypted.map(c => ({
    realName: c.realName,
    code: c.id === participantContactId ? participantCode ?? 'P' : 'NAME',
  }))
}
