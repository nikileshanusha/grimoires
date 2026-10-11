import type { Todo } from '../types'

type Incoming = { content: string; activeForm: string; status: Todo['status'] }

// Carries each task's timing across TodoWrite rewrites, matched by content.
export function mergeTodos(prev: Todo[], next: readonly Incoming[], now: number): Todo[] {
  const byContent = new Map(prev.map(t => [t.content, t]))
  let lastDone = Math.max(0, ...prev.map(t => t.doneAt ?? 0))

  return next.map(item => {
    const old = byContent.get(item.content)
    const todo: Todo = { ...item, startedAt: old?.startedAt, doneAt: old?.doneAt }
    if (item.status === 'in_progress' && todo.startedAt === undefined) todo.startedAt = now
    if (item.status === 'completed' && todo.doneAt === undefined) {
      // A task finished without ever being marked in progress started when
      // the previous one ended, if we saw that.
      todo.startedAt ??= lastDone > 0 ? lastDone : undefined
      todo.doneAt = now
      lastDone = now
    }
    if (item.status !== 'completed') todo.doneAt = undefined

    return todo
  })
}

export function durations(list: readonly Todo[]): number[] {
  return list
    .filter(t => t.startedAt !== undefined && t.doneAt !== undefined)
    .map(t => (t.doneAt as number) - (t.startedAt as number))
    .filter(ms => ms > 0)
}

export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  const at = (i: number) => sorted[i] ?? 0

  return sorted.length % 2 === 1 ? at(mid) : (at(mid - 1) + at(mid)) / 2
}

export type Eta = {
  perTaskMs?: number
  leftMs?: number
  finishAt?: number
  done: number
  total: number
  current?: Todo
}

// Remaining tasks times the typical task, less the time already spent on
// the current one. Falls back to the median carried from earlier sessions.
export function eta(list: readonly Todo[], now: number, storedMedianMs?: number): Eta {
  const done = list.filter(t => t.status === 'completed').length
  const current = list.find(t => t.status === 'in_progress')
  const perTaskMs = median(durations(list)) ?? storedMedianMs
  const base = { done, total: list.length, current, perTaskMs }
  if (perTaskMs === undefined || list.length === 0) return base

  const pending = list.filter(t => t.status === 'pending').length
  const spent = current?.startedAt !== undefined ? now - current.startedAt : 0
  const currentLeft = current ? Math.max(perTaskMs - spent, perTaskMs * 0.15) : 0
  const leftMs = pending * perTaskMs + currentLeft

  return { ...base, leftMs, finishAt: now + leftMs }
}

// Blends this session's tasks into the rolling median kept across sessions.
export function blendMedian(stored: number | undefined, list: readonly Todo[]): number | undefined {
  const mine = median(durations(list))
  if (mine === undefined) return stored
  if (stored === undefined) return mine

  return Math.round(stored * 0.6 + mine * 0.4)
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)

  return `${h}h ${m % 60}m`
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function fmtAgo(ms: number): string {
  if (ms < 45_000) return 'just now'
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`

  return `${Math.round(ms / 86_400_000)}d`
}

export function fmtTimeOfDay(at: number): string {
  const d = new Date(at)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')

  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// A reset time as ISO 8601, whatever shape it came in: an ISO string, or
// epoch seconds or milliseconds as a number or a string of digits.
export function toResetIso(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const asNumber = typeof value === 'number' ? value : /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : undefined
  if (asNumber !== undefined) {
    if (!Number.isFinite(asNumber) || asNumber <= 0) return undefined

    return new Date(asNumber < 1e12 ? asNumber * 1000 : asNumber).toISOString()
  }
  const at = Date.parse(String(value))

  return Number.isFinite(at) ? new Date(at).toISOString() : undefined
}

// New readings replace old ones, but a reading without a reset time keeps
// the one last seen for that window while it is still ahead.
export function mergeLimits<L extends { kind: string; resetsAt?: string }>(prev: readonly L[], next: readonly L[], now: number): L[] {
  if (next.length === 0) return [...prev]

  return next.map(l => {
    if (l.resetsAt) return l
    const old = prev.find(p => p.kind === l.kind)?.resetsAt
    return old && Date.parse(old) > now ? { ...l, resetsAt: old } : l
  })
}

// A clock time at its shortest, for the status line: "10:40p", "9a".
export function fmtClockShort(at: number): string {
  const d = new Date(at)
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12
  const m = d.getMinutes()

  return `${h}${m === 0 ? '' : `:${String(m).padStart(2, '0')}`}${d.getHours() < 12 ? 'a' : 'p'}`
}
