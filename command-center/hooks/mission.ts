import type { AutoMission, Step, StepStatus, Todo } from '../types'

export const EMPTY_AUTO: AutoMission = { mission: '', steps: [], at: 0, prompts: 0 }

export const MISSION_SYSTEM =
  'You summarize a coding or research session for a calm dashboard. Reply with JSON only, no prose, no code fences.'

// What the small model reads: the person's recent asks and where the last
// answer left off. Never the whole transcript.
export function missionPrompt(asks: readonly string[], lastAnswer: string): string {
  const recent = asks
    .slice(-6)
    .map((a, i) => `${i + 1}. ${a.replace(/\s+/g, ' ').slice(0, 400)}`)
    .join('\n')

  return [
    'The person asked, oldest first:',
    recent,
    '',
    `The assistant last said: ${lastAnswer.replace(/\s+/g, ' ').slice(0, 600)}`,
    '',
    'Return {"mission": string, "steps": [{"label": string, "status": "done" | "now" | "next"}]}.',
    '- mission: what the person is working toward overall, at most 8 words, sentence case, no period.',
    '- steps: 3 to 6 short steps (at most 4 words each) from start to finish, in order;',
    '  mark finished ones "done", exactly one "now" unless all are done, the rest "next".',
  ].join('\n')
}

const STATUSES: readonly StepStatus[] = ['done', 'now', 'next']

export function parseMission(text: string): Pick<AutoMission, 'mission' | 'steps'> | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  let raw: unknown
  try {
    raw = JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
  if (!raw || typeof raw !== 'object') return undefined
  const { mission, steps } = raw as { mission?: unknown; steps?: unknown }
  if (typeof mission !== 'string' || !mission.trim()) return undefined
  const clean: Step[] = Array.isArray(steps)
    ? steps
        .filter((s): s is { label: string; status: StepStatus } =>
          !!s && typeof s === 'object' && typeof (s as Step).label === 'string' && STATUSES.includes((s as Step).status))
        .slice(0, 8)
        .map(s => ({ label: s.label.trim().slice(0, 40), status: s.status }))
    : []

  return { mission: mission.trim().replace(/\.$/, '').slice(0, 90), steps: clean }
}

// The real task list wins when there is one; the derived steps fill in.
export function stepsFor(todos: readonly Todo[], auto: AutoMission): Step[] {
  if (todos.length > 0) {
    return todos.map(t => ({
      label: t.content,
      status: t.status === 'completed' ? 'done' : t.status === 'in_progress' ? 'now' : 'next',
    }))
  }

  return auto.steps
}

// A window around the present: the last done step, now, and what follows.
// `back` scrolls the window toward earlier steps, one step at a time.
export function flowWindow(steps: readonly Step[], max: number, back = 0) {
  let at = steps.findIndex(s => s.status === 'now')
  if (at < 0) at = steps.findIndex(s => s.status === 'next')
  if (at < 0) at = steps.length
  const present = Math.max(0, Math.min(at - 1, steps.length - max))
  const start = Math.max(0, present - Math.max(0, back))
  const shown = steps.slice(start, start + max)

  return { shown, before: start, after: steps.length - start - shown.length }
}

export function nextLine(steps: readonly Step[]): string | undefined {
  const upcoming = steps.filter(s => s.status === 'next').map(s => s.label)
  if (upcoming.length === 0) return undefined
  if (upcoming.length === 1) return upcoming[0]

  return `${upcoming[0]}, then ${upcoming[1]}${upcoming.length > 2 ? ` (+${upcoming.length - 2})` : ''}`
}

// What Claude said just before a tool call is the best "why" there is: its
// last sentence, without Markdown, kept short.
export function purposeFrom(text: string): string | undefined {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return undefined
  const sentences = plain.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 3)
  const last = (sentences[sentences.length - 1] ?? plain).replace(/[:.\s]+$/, '').trim()
  if (last.length < 4) return undefined

  return last.length > 100 ? `${last.slice(0, 99)}…` : last
}
