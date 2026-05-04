import { pgTable, uuid, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { interviews } from './interviews'
import { transcripts } from './interviews'

export const markerTypeValues = ['quote', 'key_moment', 'theme', 'memo'] as const
export type MarkerType = (typeof markerTypeValues)[number]

export const markers = pgTable('markers', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id').notNull().references(() => interviews.id, { onDelete: 'cascade' }),
  transcriptId: uuid('transcript_id').references(() => transcripts.id),
  segmentIdx: integer('segment_idx').notNull(),
  charStart: integer('char_start'),
  charEnd: integer('char_end'),
  startSeconds: numeric('start_seconds'),
  endSeconds: numeric('end_seconds'),
  type: text('type').notNull().$type<MarkerType>(),
  excerpt: text('excerpt'),
  note: text('note'),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const markersRelations = relations(markers, ({ one }) => ({
  interview: one(interviews, {
    fields: [markers.interviewId],
    references: [interviews.id],
  }),
}))

export type Marker = typeof markers.$inferSelect
export type MarkerInsert = typeof markers.$inferInsert
