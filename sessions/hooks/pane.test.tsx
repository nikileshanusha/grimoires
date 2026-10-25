import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'sessions',
  component: 'Pane',
  requestId: 'sessions',
  props: {
    title: 'Sessions',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const now = Date.now()
const SEED = [
  { id: '11111111-1111-1111-1111-111111111111', time: now, cwd: 'C:\Users\N', title: 'This one', bytes: 1000 },
  { id: '22222222-2222-2222-2222-222222222222', time: now - 3 * 86_400_000, cwd: 'C:\Users\N\Desktop\gnp_data', title: 'Regressions', bytes: 14_000_000 },
]

test('the pane draws folders and rows on every surface', async ($, on) => {
  const held: Record<string, unknown> = { sessions: { shape: 'sessions-1', value: SEED }, filter: '', hits: null, selected: null, confirm: null, message: '' }
  on('state.get', (_, e: any) => ({ value: { value: held[e.key], version: 1 } }))
  on('session.id', () => ({ value: SEED[0]!.id }))

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /gnp_data/ }))).toBeDefined()
    expect((await ui.findAll({ type: 'Button' })).length).toBeGreaterThan(4)
    await ui.unmount()
  }
})
