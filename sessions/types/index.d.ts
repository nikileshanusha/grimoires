export type Session = { id: string; time: number; cwd: string; title: string; bytes: number }

declare module 'claude-code' {
  interface PluginState {
    sessions: {
      sessions: Shaped<Session[]>
      filter: string
      hits: string[] | null
      selected: string | null
      confirm: string | null
      message: string
    }
  }
}
