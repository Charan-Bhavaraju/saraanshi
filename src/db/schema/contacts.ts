import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

export const contactTypeEnum = pgEnum('contact_type', [
  'hospital',
  'doctor',
  'receptionist',
  'patient',
  'other',
])

export const contactStatusEnum = pgEnum('contact_status', [
  'lead',
  'contacted',
  'interested',
  'scheduled',
  'interviewed',
  'declined',
  'done',
  'no_response',
  'no_reply',
])

export const consentStatusEnum = pgEnum('consent_status', [
  'not_yet',
  'verbal',
  'written',
  'withdrawn',
])

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: contactTypeEnum('type').notNull().default('other'),
  displayName: text('display_name').notNull(),
  // real_name is stored encrypted at rest via pgsodium TCE (see migration SQL).
  // The app always reads from the decrypted_contacts view when real name is needed.
  realName: text('real_name'),
  organization: text('organization'),
  role: text('role'),
  phone: text('phone'),
  email: text('email'),
  whatsapp: text('whatsapp'),
  location: text('location'),
  status: contactStatusEnum('status').notNull().default('lead'),
  // self-referential: patient → doctor → hospital
  parentId: uuid('parent_id').references((): AnyPgColumn => contacts.id),
  notes: text('notes'),
  tags: text('tags').array(),
  consentStatus: consentStatusEnum('consent_status').notNull().default('not_yet'),
  lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  parent: one(contacts, {
    fields: [contacts.parentId],
    references: [contacts.id],
    relationName: 'contact_hierarchy',
  }),
  children: many(contacts, { relationName: 'contact_hierarchy' }),
}))

export type Contact = typeof contacts.$inferSelect
export type ContactInsert = typeof contacts.$inferInsert
export type ContactType = (typeof contactTypeEnum.enumValues)[number]
export type ContactStatus = (typeof contactStatusEnum.enumValues)[number]
export type ConsentStatus = (typeof consentStatusEnum.enumValues)[number]
