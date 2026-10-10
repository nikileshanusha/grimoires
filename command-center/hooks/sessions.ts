import type { LiveSession } from '../types'

// Pure parsing for the session registry and transcripts; register.tsx does
// the reading.

export const basename = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() ?? path

export const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/'))

export function entryOf(entrypoint: unknown): LiveSession['entry'] {
  const text = String(entrypoint ?? '').toLowerCase()
  if (text.includes('desktop')) return 'desktop'
  if (/vscode|jetbrains|cursor|windsurf|ide/.test(text)) return 'ide'

  return 'terminal'
}

export function parsePids(stdout: string): Set<number> {
  const pids = new Set<number>()
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^"[^"]*","(\d+)"/) ?? line.match(/^\s*(\d+)\s*$/)
    if (match) pids.add(Number(match[1]))
  }

  return pids
}

// A card from ~/.claude/sessions/<pid>.json, or undefined when it is not one
// or its process has gone.
export function parseCard(text: string, mtimeMs: number, hereId: string, alive?: ReadonlySet<number>): LiveSession | undefined {
  let card: Record<string, unknown>
  try {
    card = JSON.parse(text)
  } catch {
    return undefined
  }
  const pid = Number(card.pid)
  if (!Number.isFinite(pid) || (alive && !alive.has(pid))) return undefined
  const cwd = String(card.cwd ?? '')
  const isBusy = card.status === 'busy'
  const sessionId = String(card.sessionId ?? '')

  return {
    pid,
    sessionId,
    cwd,
    name: typeof card.name === 'string' && card.name ? card.name : basename(cwd),
    entry: entryOf(card.entrypoint),
    isBusy,
    since: Number((isBusy ? card.statusUpdatedAt : card.updatedAt) ?? mtimeMs),
    isHere: sessionId === hereId,
  }
}

export function sortLive(rows: LiveSession[]): LiveSession[] {
  return rows.sort((a, b) => Number(b.isHere) - Number(a.isHere) || Number(b.isBusy) - Number(a.isBusy) || b.since - a.since)
}

function textOf(content: unknown): string | undefined {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const block = content.find(b => b && typeof b === 'object' && (b as { type?: string }).type === 'text')

    return block ? String((block as { text?: unknown }).text ?? '') : undefined
  }

  return undefined
}

// The first real prompt names a transcript; its cwd names the project.
export function describeTranscript(text: string): { title: string; project: string } {
  let title = ''
  let project = ''
  for (const line of text.split('\n', 400)) {
    if (!line.trim()) continue
    let row: Record<string, unknown>
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    if (!project && typeof row.cwd === 'string') project = basename(row.cwd)
    if (!title && row.type === 'user' && !row.isMeta) {
      const said = textOf((row.message as { content?: unknown } | undefined)?.content)?.trim()
      if (said && !said.startsWith('<')) title = said.replace(/\s+/g, ' ').slice(0, 80)
    }
    if (title && project) break
  }

  return { title: title || 'Untitled session', project }
}

export function projectFromDir(dir: string): string {
  const parts = dir.split('-').filter(Boolean)

  return parts[parts.length - 1] ?? dir
}

export const CACHE_5M = 5 * 60_000
export const CACHE_1H = 60 * 60_000

// The cache lifetime a transcript's replies were written with: the last
// response that wrote to the cache says which, 5 minutes or an hour.
export function cacheTtlOf(text: string): number | undefined {
  let ttl: number | undefined
  for (const m of text.matchAll(/"ephemeral_(1h|5m)_input_tokens":\s*([1-9])/g)) ttl = m[1] === '1h' ? CACHE_1H : CACHE_5M

  return ttl
}

// What is left of a session's prompt cache, in milliseconds; 0 when cold.
export function cacheLeft(lastAt: number | undefined, now: number, ttlMs: number): number {
  if (lastAt === undefined) return 0

  return Math.max(0, lastAt + ttlMs - now)
}

// Where Claude Code keeps a session's transcript: the cwd with every
// character but letters and digits turned into a dash.
export function transcriptPath(home: string, cwd: string, sessionId: string): string {
  return `${home}/.claude/projects/${cwd.replace(/[^A-Za-z0-9]/g, '-')}/${sessionId}.jsonl`
}
