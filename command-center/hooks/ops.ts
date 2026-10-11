import type { CustomAction, View } from '../types'
import type { IconName } from './icons'
import { C } from './visuals'

export const PANE = 'command-center'
export const TITLE = 'Command center'

// What the pane's controls can ask for. register.tsx builds these as
// closures over the engine; the cards only call them.
export type Act = {
  setView: (patch: Partial<View>) => void
  askConfirm: (key: string) => void
  cancelConfirm: () => void
  setDraft: (text: string) => void
  sendDraft: () => void
  saveNote: (text: string) => void
  sendNote: (text: string) => void
  openNotes: () => void
  // Shows a folder in the file manager.
  openFolder: (path: string) => void
  setGlance: (isOn: boolean) => void
  pinMission: (text: string) => void
  unpinMission: () => void
  openFull: () => void
  copy: (text: string) => void
  removeNote: (id: string) => void
  submit: (text: string) => void
  spawn: (helper: string, task: string) => void
  refreshPast: () => void
  refreshAll: () => void
  // Shows a limit's details and reads the figures again.
  aboutLimit: (text: string) => void
  deleteSession: (path: string) => void
  cleanupOld: (days: number) => void
  restore: (trashedPath: string) => void
  emptyTrash: () => void
  clearSession: () => void
}

export type Helper = {
  label: string
  icon: IconName
  color: string
  model: string
  description: string
  tools: string[]
  prompt: string
}

// Lighter agents the pane can hand work to: cheap models, narrow tools.
export const HELPERS: Record<string, Helper> = {
  scout: {
    label: 'Scout',
    icon: 'binoculars',
    color: C.teal,
    model: 'haiku',
    description: 'Finds things in the codebase or notes and summarizes them briefly. Read-only.',
    tools: ['Read', 'Grep', 'Glob'],
    prompt:
      'You are Scout, a fast read-only helper. Find what was asked, then answer in at most 8 short bullets with file paths. Do not modify anything.',
  },
  tester: {
    label: 'Tester',
    icon: 'flask',
    color: C.amber,
    model: 'sonnet',
    description: 'Runs the project tests or a given command and reports failures concisely.',
    tools: ['Read', 'Grep', 'Glob', 'Bash', 'PowerShell'],
    prompt:
      'You are Tester. Work out how this project runs its tests, run them (or the command given), and report: pass/fail counts, then each failure in one line with its file. Do not edit files.',
  },
  scribe: {
    label: 'Scribe',
    icon: 'feather',
    color: C.pink,
    model: 'haiku',
    description: 'Drafts short docs, notes, summaries or commit messages.',
    tools: ['Read', 'Grep', 'Glob', 'Write'],
    prompt:
      'You are Scribe. Draft the requested text clearly and briefly in plain language. Write a file only when asked to; otherwise return the text.',
  },
}

export function helperOf(type: string): { icon: IconName; color: string; label: string } {
  const helper = HELPERS[type.replace(/^command-center:/, '')]
  if (helper) return helper
  if (/explore/i.test(type)) return { icon: 'compass', color: C.blue, label: 'Explore' }
  if (/plan/i.test(type)) return { icon: 'list-check', color: C.indigo, label: 'Plan' }

  return { icon: 'robot', color: C.blue, label: type || 'Agent' }
}

export const BUILT_IN_ACTIONS: (CustomAction & { icon: IconName; color: string; id: string })[] = [
  {
    id: 'recap',
    label: 'Recap',
    icon: 'file-text',
    color: C.mission,
    prompt: 'Give me a short recap of this session: what is done, what is in progress, and the next step. 3 to 5 bullets.',
  },
  {
    id: 'review',
    label: 'Review',
    icon: 'eye-check',
    color: C.blue,
    prompt: 'Review the changes made in this session for bugs and easy simplifications. List findings by severity, briefly.',
  },
  {
    id: 'tests',
    label: 'Tests',
    icon: 'flask',
    color: C.amber,
    prompt: "Run this project's tests and summarize the result: counts, then one line per failure.",
  },
  { id: 'compact', label: 'Compact', icon: 'arrows-minimize', color: C.teal, prompt: '/compact' },
]
