'use server'

import { db } from '@/db'
import { contacts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

// Reads real_name from the contacts table (or the pgsodium decrypted_contacts
// view if 0001_pgsodium_tce.sql has been run). Gracefully falls back to the
// plaintext column if the decrypted view doesn't exist yet.
export async function revealRealName(id: string): Promise<string | null> {
  try {
    // Try the pgsodium decrypted view first (available after 0001 migration)
    const rows = await db.execute(
      sql`SELECT decrypted_real_name FROM decrypted_contacts WHERE id = ${id} LIMIT 1`,
    )
    const row = (rows as unknown as Array<Record<string, unknown>>)[0]
    const name = row?.decrypted_real_name
    console.info(`[AUDIT] real_name (decrypted) revealed for contact ${id}`)
    return typeof name === 'string' ? name : null
  } catch {
    // decrypted_contacts view not available — fall back to plaintext column
    const [row] = await db
      .select({ realName: contacts.realName })
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1)
    console.info(`[AUDIT] real_name (plaintext) revealed for contact ${id}`)
    return row?.realName ?? null
  }
}
