import { z } from 'zod'

export const TaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(500),
  description: z.string().max(2000).optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  remindAt: z.string().datetime().optional().nullable(),
  priority: z.number().int().min(0).max(3).default(0),
})

export const TaskInsertSchema = TaskSchema
export const TaskUpdateSchema = TaskSchema.partial().extend({
  id: z.string().uuid(),
})

export const QuickAddSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(500),
  dueAt: z.string().datetime().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
})

export type TaskFormValues = z.infer<typeof TaskSchema>
export type TaskUpdateValues = z.infer<typeof TaskUpdateSchema>
export type QuickAddValues = z.infer<typeof QuickAddSchema>
