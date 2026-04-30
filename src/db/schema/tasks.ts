import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  smallint,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { contacts } from './contacts'

export const taskStatusEnum = pgEnum('task_status', [
  'todo',
  'done',
  'snoozed',
  'cancelled',
])

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  contactId: uuid('contact_id').references(() => contacts.id),
  location: text('location'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  remindAt: timestamp('remind_at', { withTimezone: true }),
  remindedAt: timestamp('reminded_at', { withTimezone: true }),
  status: taskStatusEnum('status').notNull().default('todo'),
  priority: smallint('priority').notNull().default(0),
  recurrence: text('recurrence'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const tasksRelations = relations(tasks, ({ one }) => ({
  contact: one(contacts, {
    fields: [tasks.contactId],
    references: [contacts.id],
  }),
}))

export type Task = typeof tasks.$inferSelect
export type TaskInsert = typeof tasks.$inferInsert
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number]
