'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ContactSchema, type ContactFormValues } from '@/lib/validations/contact'
import { createContact, updateContact } from '../actions'
import type { Contact } from '@/types/database'

const TYPES = ['hospital', 'doctor', 'receptionist', 'patient', 'survivor', 'other'] as const
const STATUSES = ['lead', 'contacted', 'interested', 'scheduled', 'interviewed', 'declined', 'done', 'no_response'] as const
const CONSENT_STATUSES = ['not_yet', 'verbal', 'written', 'withdrawn'] as const

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium mb-1" style={{ color: '#4A5263' }}>
      {children}
    </label>
  )
}

function Input({
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div>
      <input
        {...props}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
        style={{
          border: `1px solid ${error ? '#B8456D' : '#ECE6D9'}`,
          background: '#FFFFFF',
          color: '#1A1F2C',
        }}
        onFocus={e => {
          if (!error) {
            e.target.style.borderColor = '#0E5C5C'
            e.target.style.boxShadow = '0 0 0 3px #E2EEEC'
          }
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? '#B8456D' : '#ECE6D9'
          e.target.style.boxShadow = 'none'
        }}
      />
      {error && <p className="text-xs mt-1" style={{ color: '#B8456D' }}>{error}</p>}
    </div>
  )
}

function Select({
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <div>
      <select
        {...props}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all cursor-pointer"
        style={{
          border: `1px solid ${error ? '#B8456D' : '#ECE6D9'}`,
          background: '#FFFFFF',
          color: '#1A1F2C',
        }}
      >
        {children}
      </select>
      {error && <p className="text-xs mt-1" style={{ color: '#B8456D' }}>{error}</p>}
    </div>
  )
}

function Textarea({
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <div>
      <textarea
        {...props}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all resize-none"
        style={{
          border: `1px solid ${error ? '#B8456D' : '#ECE6D9'}`,
          background: '#FFFFFF',
          color: '#1A1F2C',
        }}
        onFocus={e => {
          e.target.style.borderColor = '#0E5C5C'
          e.target.style.boxShadow = '0 0 0 3px #E2EEEC'
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? '#B8456D' : '#ECE6D9'
          e.target.style.boxShadow = 'none'
        }}
      />
      {error && <p className="text-xs mt-1" style={{ color: '#B8456D' }}>{error}</p>}
    </div>
  )
}

export default function ContactForm({
  contact,
  onDone,
}: {
  contact?: Contact
  onDone: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(ContactSchema),
    defaultValues: contact
      ? {
          type: contact.type,
          displayName: contact.displayName,
          realName: contact.realName ?? '',
          organization: contact.organization ?? '',
          role: contact.role ?? '',
          phone: contact.phone ?? '',
          email: contact.email ?? '',
          whatsapp: contact.whatsapp ?? '',
          location: contact.location ?? '',
          status: contact.status,
          notes: contact.notes ?? '',
          consentStatus: contact.consentStatus,
        }
      : {
          type: 'other',
          status: 'lead',
          consentStatus: 'not_yet',
        },
  })

  function onSubmit(values: ContactFormValues) {
    setServerError(null)
    startTransition(async () => {
      try {
        if (contact) {
          await updateContact({ ...values, id: contact.id })
        } else {
          await createContact(values)
        }
        onDone()
      } catch (err) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#F7E5EB', color: '#B8456D' }}>
          {serverError}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Type *</Label>
          <Select {...register('type')} error={errors.type?.message}>
            {TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select {...register('status')} error={errors.status?.message}>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Display name / pseudonym *</Label>
        <Input
          {...register('displayName')}
          placeholder="P-007 or Dr. Rajitha"
          error={errors.displayName?.message}
        />
        <p className="text-xs mt-1" style={{ color: '#8A929C' }}>
          For patients: use a pseudonym or participant code. Real name below.
        </p>
      </div>

      <div>
        <Label>Real name (encrypted at rest)</Label>
        <Input
          {...register('realName')}
          placeholder="Lakshmi Reddy — stored encrypted, never shown in lists"
          error={errors.realName?.message}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Organization / hospital</Label>
          <Input
            {...register('organization')}
            placeholder="MNJ Cancer Hospital"
            error={errors.organization?.message}
          />
        </div>
        <div>
          <Label>Role</Label>
          <Input
            {...register('role')}
            placeholder="Oncologist, Stage II patient…"
            error={errors.role?.message}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Phone</Label>
          <Input {...register('phone')} placeholder="+91 98765 43210" type="tel" />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input {...register('whatsapp')} placeholder="+91 98765 43210" type="tel" />
        </div>
      </div>

      <div>
        <Label>Email</Label>
        <Input {...register('email')} placeholder="doctor@hospital.in" type="email" error={errors.email?.message} />
      </div>

      <div>
        <Label>Location</Label>
        <Input {...register('location')} placeholder="Apollo Jubilee Hills, Hyderabad" />
      </div>

      <div>
        <Label>Consent status</Label>
        <Select {...register('consentStatus')}>
          {CONSENT_STATUSES.map(s => (
            <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea
          {...register('notes')}
          rows={3}
          placeholder="Any context useful for follow-up…"
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            border: '1px solid #ECE6D9',
            background: '#FFFFFF',
            color: '#4A5263',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
          style={{
            background: '#0E5C5C',
            color: '#FFFFFF',
            border: '1px solid #0E5C5C',
          }}
        >
          {isPending ? 'Saving…' : contact ? 'Save changes' : 'Add contact'}
        </button>
      </div>
    </form>
  )
}
