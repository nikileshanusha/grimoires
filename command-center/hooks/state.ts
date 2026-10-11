import type { View } from '../types'



export const DEFAULT_VIEW: View = {
  layout: 'strip',
  glance: true,
  glanceExpanded: false,
  sessionsTab: 'live',
  drawerTab: 'activity',
  helper: 'scout',
  pastPage: 0,
}

// What outlives the session lives in $.store under these keys.
export const STORE = {
  notes: 'notes',
  actions: 'actions',
  view: 'view',
  trash: 'trash',
  taskMedianMs: 'taskMedianMs',
  titles: 'titles',
  // The last rate-limit readings as the engine gave them, for diagnosis.
  limitsSeen: 'limitsSeen',
  // True after /cc off: the pane no longer opens by itself in new sessions.
  paneOff: 'paneOff',
} as const
