import { z } from 'zod'

export const ContactSchema = z.object({
  type: z.enum(['hospital', 'doctor', 'receptionist', 'patient', 'survivor', 'other']),
  displayName: z.string().min(1, 'Name is required').max(200),
  realName: z.string().max(200).optional().nullable(),
  organization: z.string().max(200).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  whatsapp: z.string().max(30).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  status: z.enum(['lead', 'contacted', 'interested', 'scheduled', 'interviewed', 'declined', 'done', 'no_response', 'no_reply']).default('lead'),
  parentId: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(50)).optional().nullable(),
  consentStatus: z.enum(['not_yet', 'verbal', 'written', 'withdrawn']).default('not_yet'),
  lastContactAt: z.string().datetime().optional().nullable(),
})

export const ContactInsertSchema = ContactSchema
export const ContactUpdateSchema = ContactSchema.partial().extend({
  id: z.string().uuid(),
})

export type ContactFormValues = z.infer<typeof ContactSchema>
export type ContactUpdateValues = z.infer<typeof ContactUpdateSchema>
