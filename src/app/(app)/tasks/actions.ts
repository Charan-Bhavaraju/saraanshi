'use server'

import { db } from '@/db'
import { tasks } from '@/db/schema'
import { TaskInsertSchema, TaskUpdateSchema, QuickAddSchema } from '@/lib/validations/task'
import { eq, isNull, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function createTask(input: z.infer<typeof TaskInsertSchema>) {
  const parsed = TaskInsertSchema.parse(input)

  const [task] = await db
    .insert(tasks)
    .values({
      title: parsed.title,
      description: parsed.description ?? null,
      contactId: parsed.contactId ?? null,
      location: parsed.location ?? null,
      dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
      remindAt: parsed.remindAt ? new Date(parsed.remindAt) : null,
      priority: parsed.priority ?? 0,
    })
    .returning()

  revalidatePath('/tasks')
  revalidatePath('/today')
  return task
}

export async function quickAddTask(input: z.infer<typeof QuickAddSchema>) {
  const parsed = QuickAddSchema.parse(input)

  const [task] = await db
    .insert(tasks)
    .values({
      title: parsed.title,
      contactId: parsed.contactId ?? null,
      dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
    })
    .returning()

  revalidatePath('/tasks')
  revalidatePath('/today')
  return task
}

export async function updateTask(input: z.infer<typeof TaskUpdateSchema>) {
  const parsed = TaskUpdateSchema.parse(input)
  const { id, ...data } = parsed

  const [task] = await db
    .update(tasks)
    .set({
      ...data,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      remindAt: data.remindAt ? new Date(data.remindAt) : undefined,
    })
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .returning()

  revalidatePath('/tasks')
  revalidatePath('/today')
  return task
}

export async function toggleTaskDone(id: string, done: boolean) {
  await db
    .update(tasks)
    .set({
      status: done ? 'done' : 'todo',
      completedAt: done ? new Date() : null,
    })
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))

  revalidatePath('/tasks')
  revalidatePath('/today')
}

export async function deleteTask(id: string) {
  await db
    .update(tasks)
    .set({ deletedAt: new Date() })
    .where(eq(tasks.id, id))

  revalidatePath('/tasks')
  revalidatePath('/today')
}
