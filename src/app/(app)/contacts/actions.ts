'use server'

import { db } from '@/db'
import { contacts } from '@/db/schema'
import { ContactInsertSchema, ContactUpdateSchema } from '@/lib/validations/contact'
import { eq, isNull, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function createContact(
  input: z.infer<typeof ContactInsertSchema>,
) {
  const parsed = ContactInsertSchema.parse(input)

  const cleanedTags = parsed.tags?.filter(Boolean) ?? null

  const [contact] = await db
    .insert(contacts)
    .values({
      type: parsed.type,
      displayName: parsed.displayName,
      realName: parsed.realName ?? null,
      organization: parsed.organization ?? null,
      role: parsed.role ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      whatsapp: parsed.whatsapp ?? null,
      location: parsed.location ?? null,
      status: parsed.status,
      parentId: parsed.parentId ?? null,
      notes: parsed.notes ?? null,
      tags: cleanedTags,
      consentStatus: parsed.consentStatus,
      lastContactAt: parsed.lastContactAt ? new Date(parsed.lastContactAt) : null,
    })
    .returning()

  revalidatePath('/contacts')
  revalidatePath('/today')
  return contact
}

export async function updateContact(
  input: z.infer<typeof ContactUpdateSchema>,
) {
  const parsed = ContactUpdateSchema.parse(input)
  const { id, ...data } = parsed

  const cleanedTags = data.tags?.filter(Boolean) ?? null

  const [contact] = await db
    .update(contacts)
    .set({
      ...data,
      tags: cleanedTags,
      lastContactAt: data.lastContactAt ? new Date(data.lastContactAt) : undefined,
    })
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .returning()

  revalidatePath('/contacts')
  revalidatePath(`/contacts/${id}`)
  revalidatePath('/today')
  return contact
}

export async function updateContactStatus(
  id: string,
  status: (typeof contacts.status.enumValues)[number],
) {
  await db
    .update(contacts)
    .set({ status, lastContactAt: new Date() })
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))

  revalidatePath('/contacts')
}

export async function deleteContact(id: string) {
  await db
    .update(contacts)
    .set({ deletedAt: new Date() })
    .where(eq(contacts.id, id))

  revalidatePath('/contacts')
  revalidatePath('/today')
}
