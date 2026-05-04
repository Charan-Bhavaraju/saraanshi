'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Contact, ContactStatus } from '@/types/database'
import ContactCard from './ContactCard'
import { updateContactStatus } from '../actions'

const COLUMNS: { status: ContactStatus; label: string; accent: string }[] = [
  { status: 'lead',        label: 'Lead',        accent: '#B5BBC4' },
  { status: 'contacted',   label: 'Contacted',   accent: '#B8842A' },
  { status: 'interested',  label: 'Interested',  accent: '#0E5C5C' },
  { status: 'scheduled',   label: 'Scheduled',   accent: '#4A5263' },
  { status: 'interviewed', label: 'Interviewed', accent: '#B8456D' },
  { status: 'no_reply', label: 'No Reply',    accent: '#8A929C' },
]

export default function ContactKanban({ contacts: initialContacts }: { contacts: Contact[] }) {
  const [contacts, setContacts] = useState(initialContacts)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sync when server revalidates
  useEffect(() => { setContacts(initialContacts) }, [initialContacts])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const byStatus = COLUMNS.reduce<Record<ContactStatus, Contact[]>>(
    (acc, col) => ({ ...acc, [col.status]: [] }),
    {} as Record<ContactStatus, Contact[]>,
  )
  for (const c of contacts) {
    const key = c.status as ContactStatus
    if (key in byStatus) byStatus[key].push(c)
  }

  const activeContact = activeId ? contacts.find(c => c.id === activeId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const contactId = active.id as string
    const newStatus = over.id as ContactStatus
    const contact = contacts.find(c => c.id === contactId)
    if (!contact || contact.status === newStatus) return

    const prevStatus = contact.status
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: newStatus } : c))
    updateContactStatus(contactId, newStatus).catch(() => {
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: prevStatus } : c))
    })
  }

  return (
    <DndContext
      id="contacts-kanban"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto pb-3 -mx-1 px-1">
        <div className="flex gap-3" style={{ minWidth: 'max(100%, 1060px)' }}>
          {COLUMNS.map(col => (
            <div key={col.status} style={{ flex: '1 1 0', minWidth: 200 }}>
              <KanbanColumn
                status={col.status}
                label={col.label}
                accent={col.accent}
                contacts={byStatus[col.status]}
                isSource={activeContact?.status === col.status}
              />
            </div>
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeContact && (
          <div style={{ transform: 'rotate(2deg)', opacity: 0.95, pointerEvents: 'none' }}>
            <ContactCard contact={activeContact} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function KanbanColumn({
  status, label, accent, contacts, isSource,
}: {
  status: ContactStatus
  label: string
  accent: string
  contacts: Contact[]
  isSource: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col">
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-1 pb-2.5 mb-2 transition-colors"
        style={{ borderBottom: `2px solid ${isOver ? accent : '#ECE6D9'}` }}
      >
        <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
          <div
            className="rounded-full shrink-0"
            style={{ width: 7, height: 7, background: accent }}
          />
          <span
            className="text-xs font-semibold uppercase tracking-wider truncate"
            style={{ color: '#4A5263' }}
          >
            {label}
          </span>
        </div>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full font-medium tabular-nums shrink-0"
          style={{ background: '#ECE6D9', color: '#4A5263' }}
        >
          {contacts.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 flex-1 rounded-xl transition-all min-h-[80px] p-1"
        style={{
          background: isOver ? `color-mix(in srgb, ${accent} 8%, transparent)` : 'transparent',
          outline: isOver ? `2px dashed color-mix(in srgb, ${accent} 50%, transparent)` : '2px dashed transparent',
          outlineOffset: -2,
        }}
      >
        {contacts.map(c => (
          <DraggableCard key={c.id} contact={c} isSource={isSource} />
        ))}

        {contacts.length === 0 && isOver && (
          <div
            className="rounded-lg flex items-center justify-center h-16 text-xs transition-all select-none"
            style={{ color: accent }}
          >
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableCard({ contact, isSource }: { contact: Contact; isSource: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        transition: isDragging ? undefined : 'opacity 0.15s',
      }}
      {...listeners}
      {...attributes}
    >
      <ContactCard contact={contact} />
    </div>
  )
}
