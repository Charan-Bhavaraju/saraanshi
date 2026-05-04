import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isThisWeek,
  startOfDay,
  endOfDay,
  addDays,
  endOfWeek,
} from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeDate(date: Date | string | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatTimeOnly(date: Date | string | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'HH:mm')
}

export function formatDateLabel(date: Date | string | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return format(d, 'HH:mm')
  if (isTomorrow(d)) return 'tomorrow'
  return format(d, 'MMM d')
}

export type TaskGroup = 'today' | 'tomorrow' | 'this_week' | 'later' | 'overdue' | 'no_date'

export function getTaskGroup(dueAt: Date | string | null): TaskGroup {
  if (!dueAt) return 'no_date'
  const d = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  const now = new Date()
  if (d < startOfDay(now)) return 'overdue'
  if (isToday(d)) return 'today'
  if (isTomorrow(d)) return 'tomorrow'
  if (isThisWeek(d, { weekStartsOn: 1 })) return 'this_week'
  return 'later'
}

export function getGreeting(): string {
  const h = parseInt(
    new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()),
    10,
  )
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function formatDayHeader(): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  }).format(new Date())
}

export { startOfDay, endOfDay, addDays, endOfWeek, isToday, isTomorrow, isThisWeek }
