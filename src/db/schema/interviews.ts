import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { contacts } from './contacts'

export const interviewTypeEnum = pgEnum('interview_type', [
  'patient',
  'doctor',
  'other',
])

export const interviewLanguageEnum = pgEnum('interview_language', [
  'en',
  'te',
  'mixed',
])

export const interviewStatusEnum = pgEnum('interview_status', [
  'draft',
  'created',
  'uploading',
  'uploaded',
  'transcribing',
  'transcribed',
  'reviewed',
  'analyzed',
])

export const interviews = pgTable('interviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').references(() => contacts.id),
  type: interviewTypeEnum('type').notNull().default('other'),
  participantCode: text('participant_code'),
  conductedAt: timestamp('conducted_at', { withTimezone: true }),
  location: text('location'),
  language: interviewLanguageEnum('language').notNull().default('mixed'),
  durationSeconds: integer('duration_seconds'),
  audioR2Key: text('audio_r2_key'),
  audioSizeBytes: bigint('audio_size_bytes', { mode: 'number' }),
  status: interviewStatusEnum('status').notNull().default('created'),
  consentRecordedAt: timestamp('consent_recorded_at', { withTimezone: true }),
  contextNotes: text('context_notes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const transcripts = pgTable('transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id').notNull().references(() => interviews.id),
  version: integer('version').notNull().default(1),
  isCurrent: boolean('is_current').notNull().default(true),
  language: interviewLanguageEnum('language').notNull().default('mixed'),
  // [{start, end, speaker, text, edited, editedByHuman, originalText?}]
  segments: jsonb('segments'),
  fullText: text('full_text'),
  wordCount: integer('word_count'),
  // Raw Sarvam response kept for reprocessing or provider swap
  rawProviderResponse: jsonb('raw_provider_response'),
  englishTranslation: text('english_translation'),
  // Segment-level translation: [{segmentIdx, enText, confidence}]
  translationSegments: jsonb('translation_segments'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const usageLog = pgTable('usage_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id').references(() => interviews.id),
  // 'sarvam' | 'anthropic'
  provider: text('provider').notNull(),
  // 'transcription' | 'translation' | 'analysis'
  operation: text('operation').notNull(),
  audioSeconds: integer('audio_seconds'),
  // Cost in paise (1/100 INR) — integer avoids floating-point issues
  costInrPaise: integer('cost_inr_paise'),
  // Provider's own request ID — checked before enqueuing to prevent double-billing
  requestId: text('request_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const interviewsRelations = relations(interviews, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [interviews.contactId],
    references: [contacts.id],
  }),
  transcripts: many(transcripts),
  usageLogs: many(usageLog),
}))

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  interview: one(interviews, {
    fields: [transcripts.interviewId],
    references: [interviews.id],
  }),
}))

export const usageLogRelations = relations(usageLog, ({ one }) => ({
  interview: one(interviews, {
    fields: [usageLog.interviewId],
    references: [interviews.id],
  }),
}))

export type Interview = typeof interviews.$inferSelect
export type InterviewInsert = typeof interviews.$inferInsert
export type InterviewType = (typeof interviewTypeEnum.enumValues)[number]
export type InterviewLanguage = (typeof interviewLanguageEnum.enumValues)[number]
export type InterviewStatus = (typeof interviewStatusEnum.enumValues)[number]

export type Transcript = typeof transcripts.$inferSelect
export type TranscriptInsert = typeof transcripts.$inferInsert

export type UsageLog = typeof usageLog.$inferSelect

// Segment shape stored in transcripts.segments JSONB
export type TranscriptSegment = {
  start: number
  end: number
  speaker: string  // 'SPEAKER_1', 'SPEAKER_2', etc.
  text: string
  edited: boolean
  editedByHuman: boolean
  originalText?: string  // preserved on first human edit
  hidden?: boolean       // user-dismissed filler segment
}

export type TranslationSegment = {
  segmentIdx: number
  enText: string
  confidence: 'high' | 'medium' | 'low'
}
