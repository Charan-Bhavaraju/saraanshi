import { z } from 'zod'

export const InterviewCreateSchema = z.object({
  contactId: z.string().uuid().nullable().optional(),
  type: z.enum(['patient', 'doctor', 'survivor', 'other']).default('other'),
  participantCode: z.string().min(1).max(20).optional().nullable(),
  conductedAt: z.string().datetime().optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  language: z.enum(['en', 'te', 'mixed']).default('mixed'),
  contextNotes: z.string().max(5000).optional().nullable(),
  consentRecordedAt: z.string().datetime().optional().nullable(),
})

export const InterviewUpdateSchema = InterviewCreateSchema.partial().extend({
  id: z.string().uuid(),
})

export const InterviewAudioSchema = z.object({
  id: z.string().uuid(),
  audioR2Key: z.string().min(1),
  audioSizeBytes: z.number().int().positive(),
  durationSeconds: z.number().int().positive().optional().nullable(),
})

export type InterviewCreateValues = z.infer<typeof InterviewCreateSchema>
export type InterviewUpdateValues = z.infer<typeof InterviewUpdateSchema>
export type InterviewAudioValues = z.infer<typeof InterviewAudioSchema>
