export type Layout = 'rows' | 'columns' | 'strip' | 'focus'
export type SessionsTab = 'live' | 'past' | 'trash'
export type DrawerTab = 'activity' | 'agents' | 'sessions' | 'notes'
export type ToolKind = 'edit' | 'run' | 'read' | 'agent' | 'tool'

export type Todo = {
  content: string
  activeForm: string
  status: 'pending' | 'in_progress' | 'completed'
  startedAt?: number
  doneAt?: number
}

export type FeedItem = {
  id: string
  kind: ToolKind
  verb: string
  label: string
  detail?: string
  why?: string
  out?: string
  startedAt: number
  endedAt?: number
  isError?: boolean
}

export type Counts = { edits: number; runs: number; errors: number }

export type Limit = { kind: string; percent: number; resetsAt?: string }

export type Measure = { context?: number; limits: Limit[] }

export type AgentRow = {
  id: string
  description: string
  type: string
  status: string
  firstSeenAt: number
  endedAt?: number
}

export type LiveSession = {
  pid: number
  sessionId: string
  name: string
  cwd: string
  entry: 'terminal' | 'ide' | 'desktop'
  isBusy: boolean
  since: number
  isHere: boolean
  /** When its transcript last changed: the last reply, near enough. */
  lastAt?: number
  /** How long its prompt cache lives: 5 minutes or an hour. */
  cacheTtlMs?: number
}

export type PastSession = {
  path: string
  sessionId: string
  project: string
  title: string
  mtimeMs: number
  size: number
  isLive: boolean
  cacheTtlMs?: number
  // The folder it ran in, from the transcript.
  cwd?: string
}

export type TrashItem = {
  trashedPath: string
  originalPath: string
  project: string
  title: string
  size: number
  deletedAt: number
}

export type StepStatus = 'done' | 'now' | 'next'
export type Step = { label: string; status: StepStatus }

// The mission as the conversation suggests it, refreshed after turns.
export type AutoMission = { mission: string; steps: Step[]; at: number; prompts: number }

export type Note = { id: string; text: string; at: number }

export type CustomAction = { label: string; prompt: string }

export type View = {
  layout: Layout
  glance: boolean
  glanceExpanded: boolean
  sessionsTab: SessionsTab
  drawerTab: DrawerTab
  helper: string
  pastPage: number
  confirm?: string
  openActivity?: string
  flowOffset?: number
  // The session whose details are open in the Sessions card.
  openSession?: string
  // The Sessions card shows every row instead of the first few.
  sessionsAll?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'command-center': {
      goal: string
      auto: AutoMission
      todos: Todo[]
      feed: FeedItem[]
      counts: Counts
      measure: Measure
      turnStartedAt: number
      agents: AgentRow[]
      live: LiveSession[]
      past: PastSession[]
      trash: TrashItem[]
      notes: Note[]
      /** Bumps on each save or send, so the note field starts empty again. */
      draftGen: number
      actions: CustomAction[]
      view: View
      tick: number
    }
  }
}
