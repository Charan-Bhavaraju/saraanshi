export type {
  Contact,
  ContactInsert,
  ContactType,
  ContactStatus,
  ConsentStatus,
} from '@/db/schema/contacts'

export type {
  Task,
  TaskInsert,
  TaskStatus,
} from '@/db/schema/tasks'

export type {
  Interview,
  InterviewInsert,
  InterviewType,
  InterviewLanguage,
  InterviewStatus,
  Transcript,
  TranscriptInsert,
  UsageLog,
  TranscriptSegment,
  TranslationSegment,
} from '@/db/schema/interviews'

export type {
  Marker,
  MarkerInsert,
  MarkerType,
} from '@/db/schema/markers'

export type {
  Confidence,
  ReflectionSource,
  ThemeCreatedBy,
  NotableMoment,
  ChatSource,
  ChatMessage,
  InterviewReflection,
  InterviewReflectionInsert,
  FocusPoint,
  FocusPointInsert,
  Theme,
  ThemeInsert,
  ThemeCode,
  ThemeCodeInsert,
  TranscriptChunk,
  TranscriptChunkInsert,
  AnalysisSession,
  AnalysisSessionInsert,
  ThemeSuggestion,
  ThemeSuggestionInsert,
  ClusterWatermark,
} from '@/db/schema/analysis'

// Task with its linked contact populated (for display)
export type TaskWithContact = import('@/db/schema/tasks').Task & {
  contact: Pick<
    import('@/db/schema/contacts').Contact,
    'id' | 'displayName' | 'organization' | 'type'
  > | null
}

// Contact with its parent populated (for detail view)
export type ContactWithParent = import('@/db/schema/contacts').Contact & {
  parent: Pick<
    import('@/db/schema/contacts').Contact,
    'id' | 'displayName' | 'organization' | 'type'
  > | null
}

// Interview with its linked contact populated
export type InterviewWithContact = import('@/db/schema/interviews').Interview & {
  contact: Pick<
    import('@/db/schema/contacts').Contact,
    'id' | 'displayName' | 'organization' | 'type'
  > | null
}
