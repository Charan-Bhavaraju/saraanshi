import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  numeric,
  timestamp,
  vector,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { interviews } from './interviews'

// ─── Shared value types ───
export const confidenceValues = ['high', 'medium', 'low'] as const
export type Confidence = (typeof confidenceValues)[number]

export const reflectionSourceValues = ['cleaned', 'raw', 'translation', 'mixed'] as const
export type ReflectionSource = (typeof reflectionSourceValues)[number]

export const themeCreatedByValues = ['user', 'cluster'] as const
export type ThemeCreatedBy = (typeof themeCreatedByValues)[number]

// JSONB payload shapes
export type NotableMoment = { seconds: number; reason: string }
export type ChatSource = {
  chunkId: string
  interviewId: string
  participantCode: string | null
  startSeconds: number
  preview: string
}
export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
}

// ─── Layer 1: per-interview analysis ───
export const interviewReflections = pgTable('interview_reflections', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id')
    .notNull()
    .unique()
    .references(() => interviews.id, { onDelete: 'cascade' }),
  sourceUsed: text('source_used').notNull().$type<ReflectionSource>(),
  summary: text('summary'),
  notableMoments: jsonb('notable_moments').$type<NotableMoment[]>(),
  openQuestions: jsonb('open_questions').$type<string[]>(),
  userReflection: text('user_reflection'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
  lastUserEditAt: timestamp('last_user_edit_at', { withTimezone: true }),
  llmModel: text('llm_model'),
  costInrPaise: integer('cost_inr_paise'),
})

export const focusPoints = pgTable('focus_points', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id')
    .notNull()
    .references(() => interviews.id, { onDelete: 'cascade' }),
  phrase: text('phrase').notNull(),
  rationale: text('rationale'),
  confidence: text('confidence').notNull().$type<Confidence>(),
  timestamps: jsonb('timestamps').$type<number[]>(),
  embedding: vector('embedding', { dimensions: 768 }),
  promotedToThemeId: uuid('promoted_to_theme_id'),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Layer 1b: objective-mapped findings ───
export const objectiveValues = ['objective_1', 'objective_2', 'objective_3'] as const
export type Objective = (typeof objectiveValues)[number]

export const findingCategoryValues = ['facilitator', 'barrier'] as const
export type FindingCategory = (typeof findingCategoryValues)[number]

export const objectiveFindings = pgTable('objective_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id')
    .notNull()
    .references(() => interviews.id, { onDelete: 'cascade' }),
  objective: text('objective').notNull().$type<Objective>(),
  category: text('category').notNull().$type<FindingCategory>(),
  label: text('label').notNull(),
  excerpt: text('excerpt'),
  rationale: text('rationale'),
  timestamps: jsonb('timestamps').$type<number[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// One row per interview — tracks when objectives were last generated.
export const objectiveRuns = pgTable('objective_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id')
    .notNull()
    .unique()
    .references(() => interviews.id, { onDelete: 'cascade' }),
  sourceUsed: text('source_used').notNull().$type<ReflectionSource>(),
  llmModel: text('llm_model'),
  costInrPaise: integer('cost_inr_paise'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
})

// ─── Layer 2: themes (her authoritative coding scheme) ───
export const themes = pgTable('themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  parentId: uuid('parent_id'),
  definition: text('definition'),
  color: text('color'),
  createdBy: text('created_by').notNull().default('user').$type<ThemeCreatedBy>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const themeCodes = pgTable('theme_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  themeId: uuid('theme_id')
    .notNull()
    .references(() => themes.id, { onDelete: 'cascade' }),
  interviewId: uuid('interview_id')
    .notNull()
    .references(() => interviews.id, { onDelete: 'cascade' }),
  focusPointId: uuid('focus_point_id').references(() => focusPoints.id),
  segmentIdx: integer('segment_idx'),
  excerpt: text('excerpt'),
  memo: text('memo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Layer 3: RAG chunks ───
export const transcriptChunks = pgTable('transcript_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  interviewId: uuid('interview_id')
    .notNull()
    .references(() => interviews.id, { onDelete: 'cascade' }),
  chunkIdx: integer('chunk_idx').notNull(),
  content: text('content').notNull(),
  startSeconds: numeric('start_seconds'),
  endSeconds: numeric('end_seconds'),
  embedding: vector('embedding', { dimensions: 768 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const analysisSessions = pgTable('analysis_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  scope: jsonb('scope').$type<{ interviewIds?: string[]; themeIds?: string[] }>(),
  messages: jsonb('messages').$type<ChatMessage[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Layer 2 cluster cache ───
export const themeSuggestions = pgTable('theme_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberFocusPointIds: uuid('member_focus_point_ids').array().notNull(),
  interviewCount: integer('interview_count').notNull().default(0),
  suggestedName: text('suggested_name'),
  examplePhrases: jsonb('example_phrases').$type<string[]>(),
  dismissed: boolean('dismissed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const clusterWatermark = pgTable('cluster_watermark', {
  id: uuid('id').primaryKey().defaultRandom(),
  openFocusPointCount: integer('open_focus_point_count').notNull().default(0),
  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow(),
})

// ─── Relations ───
export const interviewReflectionsRelations = relations(interviewReflections, ({ one }) => ({
  interview: one(interviews, {
    fields: [interviewReflections.interviewId],
    references: [interviews.id],
  }),
}))

export const objectiveFindingsRelations = relations(objectiveFindings, ({ one }) => ({
  interview: one(interviews, {
    fields: [objectiveFindings.interviewId],
    references: [interviews.id],
  }),
}))

export const objectiveRunsRelations = relations(objectiveRuns, ({ one }) => ({
  interview: one(interviews, {
    fields: [objectiveRuns.interviewId],
    references: [interviews.id],
  }),
}))

export const focusPointsRelations = relations(focusPoints, ({ one }) => ({
  interview: one(interviews, {
    fields: [focusPoints.interviewId],
    references: [interviews.id],
  }),
  promotedTheme: one(themes, {
    fields: [focusPoints.promotedToThemeId],
    references: [themes.id],
  }),
}))

export const themesRelations = relations(themes, ({ one, many }) => ({
  parent: one(themes, {
    fields: [themes.parentId],
    references: [themes.id],
    relationName: 'theme_hierarchy',
  }),
  children: many(themes, { relationName: 'theme_hierarchy' }),
  codes: many(themeCodes),
}))

export const themeCodesRelations = relations(themeCodes, ({ one }) => ({
  theme: one(themes, { fields: [themeCodes.themeId], references: [themes.id] }),
  interview: one(interviews, {
    fields: [themeCodes.interviewId],
    references: [interviews.id],
  }),
  focusPoint: one(focusPoints, {
    fields: [themeCodes.focusPointId],
    references: [focusPoints.id],
  }),
}))

export const transcriptChunksRelations = relations(transcriptChunks, ({ one }) => ({
  interview: one(interviews, {
    fields: [transcriptChunks.interviewId],
    references: [interviews.id],
  }),
}))

// ─── Inferred types ───
export type InterviewReflection = typeof interviewReflections.$inferSelect
export type InterviewReflectionInsert = typeof interviewReflections.$inferInsert

export type FocusPoint = typeof focusPoints.$inferSelect
export type FocusPointInsert = typeof focusPoints.$inferInsert

export type Theme = typeof themes.$inferSelect
export type ThemeInsert = typeof themes.$inferInsert

export type ThemeCode = typeof themeCodes.$inferSelect
export type ThemeCodeInsert = typeof themeCodes.$inferInsert

export type TranscriptChunk = typeof transcriptChunks.$inferSelect
export type TranscriptChunkInsert = typeof transcriptChunks.$inferInsert

export type AnalysisSession = typeof analysisSessions.$inferSelect
export type AnalysisSessionInsert = typeof analysisSessions.$inferInsert

export type ThemeSuggestion = typeof themeSuggestions.$inferSelect
export type ThemeSuggestionInsert = typeof themeSuggestions.$inferInsert

export type ObjectiveFinding = typeof objectiveFindings.$inferSelect
export type ObjectiveFindingInsert = typeof objectiveFindings.$inferInsert

export type ObjectiveRun = typeof objectiveRuns.$inferSelect
export type ObjectiveRunInsert = typeof objectiveRuns.$inferInsert

export type ClusterWatermark = typeof clusterWatermark.$inferSelect
