'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Contact } from '@/types/database'
import ContactForm from '../_components/ContactForm'
import { deleteContact } from '../actions'

export default function ContactDetailClient({ contact }: { contact: Contact }) {
  const [showEdit, setShowEdit] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    startTransition(async () => {
      await deleteContact(contact.id)
      router.push('/contacts')
    })
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setShowEdit(true)}
          className="px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px]"
          style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#4A5263' }}
        >
          Edit
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px]"
          style={{ border: '1px solid #F0C8D4', background: '#FFFFFF', color: '#B8456D' }}
        >
          Delete
        </button>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(26, 31, 44, 0.4)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowEdit(false) }}
        >
          <div
            className="w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', boxShadow: '0 24px 48px rgb(26 31 44 / 0.2)' }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid #ECE6D9' }}
            >
              <h2 className="text-lg" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}>
                Edit contact
              </h2>
              <button
                onClick={() => setShowEdit(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: '#8A929C' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <ContactForm contact={contact} onDone={() => setShowEdit(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(26, 31, 44, 0.4)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(false) }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', boxShadow: '0 24px 48px rgb(26 31 44 / 0.2)' }}
          >
            <h2 className="text-lg mb-2" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500 }}>
              Archive contact?
            </h2>
            <p className="text-sm mb-6" style={{ color: '#4A5263' }}>
              <strong>{contact.displayName}</strong> will be soft-deleted and hidden from all views. This can be undone from the database.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#4A5263' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                style={{ background: '#B8456D', color: '#FFFFFF', border: '1px solid #B8456D' }}
              >
                {isPending ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
