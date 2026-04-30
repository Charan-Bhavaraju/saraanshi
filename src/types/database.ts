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
