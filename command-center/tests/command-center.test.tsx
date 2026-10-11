import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { encodePs, moveFailure, moveScript, olderThan } from '../hooks/cleanup'
import { TICKER_SLOT, eta, fitSlot, median, mergeLimits, mergeTodos, paceOf, statusLine, toResetIso } from '../hooks/eta'
import { fitLayout } from '../hooks/layouts'
import { groupFeed, resetText } from '../hooks/cards'
import { flowWindow, nextLine, parseMission, purposeFrom, stepsFor } from '../hooks/mission'
import { EMPTY_AUTO } from '../hooks/mission'
import { CACHE_1H, CACHE_5M, cacheLeft, cacheTtlOf, describeTranscript, parseCard, parsePids, projectDirFor, transcriptPath } from '../hooks/sessions'

const PANE_PROPS = (bodyColumns: number) => ({
  title: 'Command center',
  isFocused: false,
  bodyColumns,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
})

const engine = (on: On) => {
  mock.clock(on)
  mock.store(on)
}

const mount = (bodyColumns: number) => ({
  plugin: 'command-center',
  component: 'Pane' as const,
  requestId: 'command-center',
  props: PANE_PROPS(bodyColumns),
})

describe('eta', () => {
  test('timings carry across rewrites and the estimate follows the median', async () => {
    let list = mergeTodos([], [
      { content: 'a', activeForm: 'Doing a', status: 'in_progress' },
      { content: 'b', activeForm: 'Doing b', status: 'pending' },
      { content: 'c', activeForm: 'Doing c', status: 'pending' },
    ], 0)
    list = mergeTodos(list, [
      { content: 'a', activeForm: 'Doing a', status: 'completed' },
      { content: 'b', activeForm: 'Doing b', status: 'in_progress' },
      { content: 'c', activeForm: 'Doing c', status: 'pending' },
    ], 120_000)
    expect(list[0]).toMatchObject({ startedAt: 0, doneAt: 120_000 })
    expect(list[1]?.startedAt).toBe(120_000)

    const est = eta(list, 150_000)
    expect(est.perTaskMs).toBe(120_000)
    // One pending (2m) plus what's left of the current (2m - 30s).
    expect(est.leftMs).toBe(120_000 + 90_000)
    expect(est.done).toBe(1)
  })

  test('falls back to the stored median, and says nothing without one', async () => {
    const list = mergeTodos([], [{ content: 'x', activeForm: 'X', status: 'pending' }], 0)
    expect(eta(list, 0).leftMs).toBeUndefined()
    expect(eta(list, 0, 60_000).leftMs).toBe(60_000)
    expect(median([5, 1, 3])).toBe(3)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('sessions', () => {
  test('a registry card parses, and a dead pid drops it', async () => {
    const card = JSON.stringify({ pid: 42, sessionId: 's1', cwd: 'C:\\repos\\margins', entrypoint: 'cli', status: 'busy', statusUpdatedAt: 5, updatedAt: 9 })
    expect(parseCard(card, 0, 'other')).toMatchObject({ name: 'margins', entry: 'terminal', isBusy: true, since: 5, isHere: false })
    expect(parseCard(card, 0, 's1', new Set([1]))).toBeUndefined()
    expect(parseCard('{not json', 0, 's1')).toBeUndefined()
    expect(parsePids('"claude.exe","42","Console","1","10,000 K"\r\n"x.exe","7","Console","1","1 K"')).toEqual(new Set([42, 7]))
  })

  test('a transcript is named by its first real prompt and its folder', async () => {
    const lines = [
      JSON.stringify({ type: 'user', isMeta: true, cwd: '/home/me/margins', message: { content: '<command-name>' } }),
      JSON.stringify({ type: 'user', cwd: '/home/me/margins', message: { content: [{ type: 'text', text: 'Fix the  login\nflow' }] } }),
    ].join('\n')
    expect(describeTranscript(lines)).toEqual({ title: 'Fix the login flow', project: 'margins', cwd: '/home/me/margins' })
  })

  test('the prompt cache reads its lifetime from the transcript and counts down', async () => {
    const one = '{"usage":{"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":2574}}}'
    const five = '{"usage":{"cache_creation":{"ephemeral_5m_input_tokens":900,"ephemeral_1h_input_tokens":0}}}'
    expect(cacheTtlOf([five, one].join('\n'))).toBe(CACHE_1H)
    expect(cacheTtlOf([one, five].join('\n'))).toBe(CACHE_5M)
    expect(cacheTtlOf('{"usage":{}}')).toBe(undefined)
    expect(cacheLeft(1_000, 1_000 + 60_000, CACHE_5M)).toBe(4 * 60_000)
    expect(cacheLeft(1_000, 1_000 + 6 * 60_000, CACHE_5M)).toBe(0)
    expect(cacheLeft(undefined, 5, CACHE_1H)).toBe(0)
    expect(transcriptPath('C:/Users/me', 'C:\\Users\\me\\my app', 'abc')).toBe('C:/Users/me/.claude/projects/C--Users-me-my-app/abc.jsonl')
  })

  test('cleanup never touches live sessions and quotes paths safely', async () => {
    const now = 100 * 86_400_000
    const list = [
      { path: 'a', sessionId: 'a', project: '', title: '', mtimeMs: 0, size: 1, isLive: false },
      { path: 'b', sessionId: 'b', project: '', title: '', mtimeMs: 0, size: 1, isLive: true },
      { path: 'c', sessionId: 'c', project: '', title: '', mtimeMs: now, size: 1, isLive: false },
    ]
    expect(olderThan(list, 30, now).map(s => s.path)).toEqual(['a'])
    // Long-path safe, quoted, and never overwriting what is already there.
    const ps = moveScript("C:/it's here/x.jsonl", 'C:/t').ps
    expect(ps).toContain("'\\\\?\\C:\\it''s here\\x.jsonl'")
    expect(ps).toContain("'\\\\?\\C:\\t\\x.jsonl'")
    expect(ps).toContain('already exists')
    expect(ps).not.toContain('Move-Item')
    expect(encodePs('A')).toBe('QQA=')
  })

  test('a reset time is read in any shape and kept when a reading drops it', async () => {
    const iso = '2026-10-11T16:30:00.000Z'
    const ms = Date.parse(iso)
    expect(toResetIso(iso)).toBe(iso)
    expect(toResetIso(ms)).toBe(iso)
    expect(toResetIso(ms / 1000)).toBe(iso)
    expect(toResetIso(String(ms / 1000))).toBe(iso)
    expect(toResetIso(undefined)).toBe(undefined)
    expect(toResetIso('soon')).toBe(undefined)
    const before: { kind: string; percent: number; resetsAt?: string }[] = [{ kind: 'five_hour', percent: 40, resetsAt: iso }]
    expect(mergeLimits(before, [{ kind: 'five_hour', percent: 41 }], ms - 60_000)).toEqual([{ kind: 'five_hour', percent: 41, resetsAt: iso }])
    expect(mergeLimits(before, [{ kind: 'five_hour', percent: 41 }], ms + 60_000)).toEqual([{ kind: 'five_hour', percent: 41 }])
    expect(mergeLimits(before, [], ms)).toEqual(before)
  })

  test('the status line is calm, and adds only what needs attention', async () => {
    const now = Date.parse('2026-10-11T14:00:00')
    const resetsAt = new Date(now + 2.5 * 3_600_000).toISOString()
    const calm = { context: 32, fiveHour: { percent: 11, resetsAt }, week: { percent: 61 }, cacheLeftMs: 50 * 60_000, helpers: 0, now }
    // The slot is padded with figure spaces to one width; trim them to compare.
    const plain = (s: string) => s.replace(/\u2007+$/, '')
    expect(plain(statusLine(calm))).toBe('ctx 32% | 5h 11% | 7d 61% | 5h resets 4:30p')
    expect(plain(statusLine({ ...calm, fiveHour: { percent: 82, resetsAt } }))).toBe('ctx 32% | 5h 82% until 4:30p | 7d 61% | cache warm 50m')
    expect(plain(statusLine({ ...calm, cacheLeftMs: 4 * 60_000 }))).toBe('ctx 32% | 5h 11% | 7d 61% | cache 4m left')
    expect(plain(statusLine({ ...calm, cacheLeftMs: 0 }))).toBe('ctx 32% | 5h 11% | 7d 61% | cache cold')
    // A slow ticker: the last slot cycles through calm facts.
    const weekAt = new Date(now + 3 * 86_400_000).toISOString()
    const facts = { ...calm, week: { percent: 61, resetsAt: weekAt }, current: 'Building the ticker', otherBusy: 1 }
    const lines = [0, 1, 2, 3, 4, 5].map(tick => statusLine({ ...facts, tick }))
    // One length every turn: the anchored limits never move.
    expect(new Set(lines.map(l => l.length)).size).toBe(1)
    const slots = lines.map(l => plain(l.split(' | ')[3] ?? ''))
    // 61% used with 57% of the week gone: within 5 points, on pace.
    expect(slots.slice(0, 5)).toEqual(['5h resets 4:30p', '7d on pace', 'cache warm 50m', 'now: Building the tic…', '1 other session busy'])
    expect(slots[5]).toBe(slots[0])
    // Urgent items stay pinned: no slot is left for the ticker.
    expect(plain(statusLine({ ...facts, cacheLeftMs: 0, helpers: 1, tick: 3 }))).toBe('ctx 32% | 5h 11% | 7d 61% | cache cold')
    expect(statusLine({ ...facts, cacheLeftMs: 0, tick: 3 }).length).toBe(lines[0]?.length)
    // A long item is trimmed to the slot, never widening the line.
    expect(fitSlot('now: a task with a very long description')).toBe('now: a task with a ve…')
    expect(fitSlot('ok').length).toBe(TICKER_SLOT)
    // Never more than four items, whatever is going on.
    expect(statusLine({ ...calm, cacheLeftMs: 0, helpers: 2, etaLeftMs: 6 * 60_000 }).split(' | ')).toHaveLength(4)
    expect(statusLine({ helpers: 0, now })).toBe('command center')
  })

  test('weekly pacing compares usage with how much of the week has gone', async () => {
    const now = Date.parse('2026-10-11T12:00:00Z')
    const resetsIn = (days: number) => new Date(now + days * 86_400_000).toISOString()
    // 3.5 days left: half the week gone.
    expect(paceOf(50, resetsIn(3.5), now)).toEqual({ diff: 0, text: 'on pace', short: 'on pace' })
    expect(paceOf(63, resetsIn(3.5), now)).toEqual({ diff: 13, text: '13% over pace', short: 'pace +13%' })
    expect(paceOf(30, resetsIn(3.5), now)).toEqual({ diff: -20, text: '20% under pace', short: 'pace −20%' })
    expect(paceOf(54, resetsIn(3.5), now)?.text).toBe('on pace')
    expect(paceOf(50, undefined, now)).toBe(undefined)
    expect(paceOf(50, resetsIn(-1), now)).toBe(undefined)
  })

  test('a failed move says why in plain words', async () => {
    const clixml = '#< CLIXML <Objs><S S="Error">The process cannot access the file because it is being used by another process._x000D__x000A_</S></Objs>'
    expect(moveFailure(clixml)).toBe('it is open in another window or app; close it there first')
    expect(moveFailure("Exception calling Move: 'already exists at the destination'")).toBe('a file with that name is already there')
    expect(moveFailure('#< CLIXML <S S="Error">Something odd</S>')).toBe('Something odd')
  })

  test('a long project folder name is found by its 200-character prefix', async () => {
    const cwd = `C:\\${'deep\\'.repeat(50)}app`
    const name = cwd.replace(/[^A-Za-z0-9]/g, '-')
    const real = `${name.slice(0, 200)}-1x2y3z`
    expect(projectDirFor(cwd, ['other', real])).toBe(real)
    expect(projectDirFor('C:\\short', [])).toBe('C--short')
    expect(transcriptPath('H', cwd, 'id', [real])).toBe(`H/.claude/projects/${real}/id.jsonl`)
  })
})

describe('layouts', () => {
  test('a layout that does not fit falls back without forgetting the choice', async () => {
    expect(fitLayout('strip', 120)).toBe('strip')
    expect(fitLayout('columns', 120)).toBe('columns')
    expect(fitLayout('columns', 95)).toBe('rows')
    expect(fitLayout('focus', 60)).toBe('stacked')
  })

  test('the pane draws every layout on the terminal and the desktop', async ($, on) => {
    engine(on)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...mount(160), surface })
      expect(await ui.find({ text: /Mission/ })).toBeDefined()
      for (const layout of ['columns', 'strip', 'focus', 'rows'] as const) {
        await ui.press({ key: `layout-${layout}` })
        await ui.drawn()
        expect(await ui.find({ text: layout === 'strip' ? /Elsewhere/ : /Sessions/ })).toBeDefined()
      }
      await ui.unmount()
    }
  })

  test('narrow panes stack into one column', async ($, on) => {
    engine(on)
    const ui = await $.ui.mount({ ...mount(60), surface: 'desktop' })
    expect(await ui.find({ text: /Activity/ })).toBeDefined()
    await ui.unmount()
  })
})

describe('hooks', () => {
  test('a todo list becomes the mission, and /mission pins it', async ($, on) => {
    engine(on)
    on('tool.call', () => ({ result: { oldTodos: [], newTodos: [] } }))
    await $.tool.call({
      tool: 'TodoWrite',
      todos: [
        { content: 'Parse files', activeForm: 'Parsing files', status: 'completed' },
        { content: 'Render', activeForm: 'Rendering', status: 'in_progress' },
      ],
    })
    const ran = await $.command.run({
      command: 'mission',
      args: 'Ship the exporter',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 160 },
    })
    expect(ran.text).toBe('Mission pinned: Ship the exporter')

    const ui = await $.ui.mount({ ...mount(160), surface: 'desktop' })
    await ui.press({ key: 'layout-rows' })
    expect(await ui.find({ text: /Ship the exporter/ })).toBeDefined()
    // On the desktop the way there is a metro-line picture; its steps are in it.
    expect(JSON.stringify(await ui.drawn())).toContain('Rendering')
    await ui.press({ key: 'layout-focus' })
    expect(JSON.stringify(await ui.drawn())).toContain('Parse files')
    await ui.unmount()
  })

  test('a tool call lands in the activity feed with its outcome', async ($, on) => {
    engine(on)
    on('tool.call', () => ({ isError: true, result: 'boom' }))
    await $.tool.call({ tool: 'Bash', command: 'npm test', description: 'run tests' })
    const ui = await $.ui.mount({ ...mount(160), surface: 'terminal' })
    expect(await ui.find({ text: /run tests/ })).toBeDefined()
    // The Work tile shows the counts as figures.
    expect(await ui.find({ text: /^1 run$/ })).toBeDefined()
    expect(await ui.find({ text: /^1 error$/ })).toBeDefined()
    await ui.unmount()
  })

  test('Refresh reads everything again and shows the 5h reset time', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    mock.env(on, { USERPROFILE: 'C:/home', OS: 'Windows_NT' })
    const resetsAt = Math.round((clock.now() + 2 * 3_600_000) / 1000)
    let usageReads = 0
    on('session.usage', () => {
      usageReads++
      return { value: { startedAt: 0, context: { percent: 10 }, rateLimits: [{ kind: 'five_hour', percentUsed: 40, resetsAt }] } } as never
    })
    const ui = await $.ui.mount({ ...mount(160), surface: 'desktop' })
    await ui.press({ key: 'refresh-all' })
    expect(usageReads).toBeGreaterThan(0)
    expect(await ui.find({ text: /^5h {2}resets \d/ })).toBeDefined()
    expect(await ui.find({ text: /↻/ })).toBeUndefined()
    await ui.unmount()
  })

  test('icons press like their labels, a ring explains its limit, and the status line uses pipes', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    mock.env(on, { USERPROFILE: 'C:/home', OS: 'Windows_NT' })
    const toasts: string[] = []
    const statuses: (string | undefined)[] = []
    on('ui.toast', (_$, e) => (toasts.push(e.text), { value: undefined }) as never)
    on('ui.status', (_$, e) => (statuses.push(e.text), { value: undefined }) as never)
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    const resetsAt = new Date(clock.now() + 2 * 3_600_000).toISOString()
    await $.session.measure({ context: { window: 200_000, percent: 28 }, rateLimits: [{ kind: 'five_hour', percentUsed: 6, resetsAt }, { kind: 'seven_day', percentUsed: 61, resetsAt }], changed: ['rateLimits'] } as never)
    const ui = await $.ui.mount({ ...mount(160), surface: 'desktop' })

    // The Columns icon switches the layout, as the word beside it does.
    await ui.press({ key: 'layout-columns-icon' })
    expect(await ui.find({ key: 'layout-columns-icon' })).toBeDefined()
    await ui.press({ key: 'layout-rows-icon' })
    expect(await ui.find({ key: 'gauge-name-5h' })).toBeDefined()

    // The name under the ring says what the ring means.
    await ui.press({ key: 'gauge-name-5h' })
    expect(toasts.some(t => /^5h limit: 6% used\. Resets .+\(in 2h 0m\)\.$/.test(t))).toBe(true)

    const line = statuses.filter(Boolean).pop() ?? ''
    expect(line).toContain('|')
    // One lean line: the reset as a short clock time, no line breaks.
    expect(line).toMatch(/^ctx 28% \| 5h 6% \| 7d 61% \| 5h resets \d/)
    expect(line).not.toContain('\n')
    expect(line.length).toBeLessThan(50)
    expect(line).not.toContain('↻')
    expect(line).not.toContain('·')
    await ui.unmount()
  })

  test('a narrow pane lists the limits as rows, each with its reset time', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    mock.env(on, { USERPROFILE: 'C:/home', OS: 'Windows_NT' })
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    const resetsAt = new Date(clock.now() + 2 * 3_600_000).toISOString()
    await $.session.measure({ context: { window: 200_000, percent: 27 }, rateLimits: [{ kind: 'five_hour', percentUsed: 12, resetsAt }, { kind: 'seven_day', percentUsed: 60, resetsAt }], changed: ['rateLimits'] } as never)
    const ui = await $.ui.mount({ ...mount(45), surface: 'desktop' })
    expect(await ui.find({ text: /^5h {2}resets \d/ })).toBeDefined()
    // The weekly row shows pacing, short, not its reset day: 60% used, 99% gone.
    expect(await ui.find({ text: /^Weekly {2}pace −39%$/ })).toBeDefined()
    expect(await ui.find({ text: /↻/ })).toBeUndefined()
    expect(await ui.find({ text: '60%' })).toBeDefined()
    expect(await ui.find({ text: /│/ })).toBeUndefined()
    await ui.unmount()
  })

  test('the sessions tabs switch between live and trash', async ($, on) => {
    engine(on)
    const ui = await $.ui.mount({ ...mount(120), surface: 'terminal' })
    await ui.press({ key: 'layout-rows' })
    await ui.press({ key: 'tab-trash' })
    expect(await ui.find({ text: /Trash is empty/ })).toBeDefined()
    await ui.press({ key: 'tab-live' })
    expect(await ui.find({ text: /Trash is empty/ })).toBeUndefined()
    await ui.unmount()
  })

  test('the clear button asks first', async ($, on) => {
    engine(on)
    const ui = await $.ui.mount({ ...mount(120), surface: 'terminal' })
    await ui.press({ key: 'layout-rows' })
    await ui.press({ key: 'clear-here' })
    expect(await ui.find({ text: /Clear this chat\?/ })).toBeDefined()
    await ui.press({ key: 'confirm-clear-no' })
    expect(await ui.find({ text: /Clear this chat\?/ })).toBeUndefined()
    await ui.unmount()
  })

  test('the glance above the prompt stays to one quiet line', async ($, on) => {
    engine(on)
    const band = { plugin: 'command-center', component: 'AbovePrompt' as const, props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 140, scroll: { offset: 0, bodyRows: 20 } } }
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...band, surface } as never)
      expect(await ui.find({ text: /All quiet/ })).toBeDefined()
      expect(await ui.find({ text: /Mission/ })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('a new note saves to the list and clears the composer', async ($, on) => {
    engine(on)
    mock.env(on, { USERPROFILE: 'C:/home' })
    on('fs.write', () => ({ value: undefined }) as never)
    const ui = await $.ui.mount({ ...mount(160), surface: 'desktop' })
    await ui.press({ key: 'layout-rows' })
    // The field's own Save (or Enter) saves; there is no second Save beside it.
    expect(await ui.find({ key: 'note-save' })).toBeUndefined()
    // Typing alone writes nothing to state, so the pane never redraws mid-word.
    await ui.input({ key: 'note-draft-0', text: 'Ask about', kind: 'change' })
    expect(await ui.find({ key: 'note-draft-0' })).toBeDefined()
    await ui.input({ key: 'note-draft-0', text: 'Ask about PDF export', kind: 'submit' })
    expect(await ui.find({ text: /Ask about PDF export/ })).toBeDefined()
    // A fresh, empty field replaces the old one once the note is saved.
    expect(await ui.find({ key: 'note-draft-0' })).toBeUndefined()
    expect((await ui.find({ key: 'note-draft-1' }))?.text ?? '').toBe('')
    await ui.unmount()
  })

  test('the glance says when the 5h window resets', async () => {
    const now = Date.parse('2026-10-11T14:00:00')
    expect(resetText(new Date(now + 2.5 * 3_600_000).toISOString(), now)).toBe('4:30 pm (in 2h 30m)')
    expect(resetText(new Date(now + 11 * 3_600_000).toISOString(), now)).toBe('1:00 am tomorrow (in 11h 0m)')
    expect(resetText(new Date(now - 60_000).toISOString(), now)).toBe('now')
  })

  test('the glance leads with what is urgent and offers a compact', async ($, on) => {
    engine(on)
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    on('tool.call', () => ({ result: {} }))
    await $.session.measure({ context: { window: 200_000, percent: 85 }, rateLimits: [], changed: ['context'] } as never)
    await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'Render', activeForm: 'Rendering', status: 'in_progress' }] })
    const ui = await $.ui.mount({ plugin: 'command-center', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 160, scroll: { offset: 0, bodyRows: 20 } } } as never)
    expect(await ui.find({ text: /Context 85%/ })).toBeDefined()
    expect(await ui.find({ text: /Rendering · 1 of 1/ })).toBeDefined()
    expect(await ui.find({ key: 'glance-compact' })).toBeDefined()
    await ui.unmount()
  })

  test('the 5h timer leads the glance whole, even on a narrow band', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    const resetsAt = new Date(clock.now() + 2 * 3_600_000).toISOString()
    await $.session.measure({ context: { window: 200_000, percent: 20 }, rateLimits: [{ kind: 'five_hour', percentUsed: 72, resetsAt }], changed: ['rateLimits'] } as never)
    const ui = await $.ui.mount({ plugin: 'command-center', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 70, scroll: { offset: 0, bodyRows: 20 } } } as never)
    expect(await ui.find({ text: /^5h limit 72%$/ })).toBeDefined()
    expect(await ui.find({ text: /^resets .+ \(in 2h 0m\)$/ })).toBeDefined()
    await ui.unmount()
  })

  test('the mission is derived from the conversation until you pin one', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    on('model.complete', () => ({
      value: {
        isAnswered: true,
        text: '{"mission":"Ship the notes exporter","steps":[{"label":"Parse vault","status":"done"},{"label":"Render markdown","status":"now"},{"label":"Add tests","status":"next"}]}',
        usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      },
    }) as never)
    on('session.messages', () => ({ value: [{ role: 'user', text: 'Build an exporter for my notes', toolUses: [] }] }) as never)
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    await $.turn.complete({ answer: 'ok', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' } as never)
    await clock.settle()
    const ui = await $.ui.mount({ ...mount(160), surface: 'terminal' })
    await ui.press({ key: 'layout-rows' })
    expect(await ui.find({ text: /Ship the notes exporter/ })).toBeDefined()
    expect(await ui.find({ text: /Render markdown/ })).toBeDefined()
    await ui.press({ key: 'mission-pin' })
    expect(await ui.find({ key: 'mission-unpin' })).toBeDefined()
    await ui.unmount()
  })

  test('activity is one short line; a click opens its details', async ($, on) => {
    engine(on)
    on('tool.call', () => ({ result: {}, text: 'added 12 packages' }))
    await $.tool.call({ tool: 'Edit', file_path: 'C:/repo/src/renderer.ts', old_string: 'a', new_string: 'a\nb\nc' } as never)
    await $.tool.call({ tool: 'Bash', command: 'npm install', description: 'Install dependencies' })
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...mount(160), surface })
      await ui.press({ key: 'layout-rows' })
      expect(await ui.find({ text: /Edited renderer\.ts/ })).toBeDefined()
      // Folded: no detail shows until the row is pressed.
      expect(await ui.find({ text: /\+3 −1 lines/ })).toBeUndefined()
      const rows = (await ui.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('feed-'))
      const install = rows.find(b => /Install dependencies/.test(b.text ?? ''))
      expect(install).toBeDefined()
      await ui.press({ key: install?.key ?? '' })
      expect(await ui.find({ text: /npm install/ })).toBeDefined()
      expect(await ui.find({ text: /added 12 packages/ })).toBeDefined()
      expect(await ui.find({ text: /Copy command/ })).toBeDefined()
      await ui.press({ key: install?.key ?? '' })
      expect(await ui.find({ text: /Copy command/ })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('the glance opens a little with More and folds back with Less', async ($, on) => {
    engine(on)
    const band = { plugin: 'command-center', component: 'AbovePrompt' as const, props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 140, scroll: { offset: 0, bodyRows: 20 } } }
    const ui = await $.ui.mount({ ...band, surface: 'desktop' } as never)
    expect(await ui.find({ key: 'mission-pin' })).toBeUndefined()
    await ui.press({ key: 'glance-more' })
    expect(await ui.find({ text: /Recap/ })).toBeDefined()
    await ui.press({ key: 'glance-more' })
    expect(await ui.find({ text: /Recap/ })).toBeUndefined()
    await ui.unmount()
  })
})

describe('mission and activity logic', () => {
  test('a model reply parses, and the task list outranks it', async () => {
    const parsed = parseMission('Sure! {"mission":"Fix login.","steps":[{"label":"Find bug","status":"done"},{"label":"Patch","status":"now"},{"label":"bad","status":"maybe"}]}')
    expect(parsed).toEqual({ mission: 'Fix login', steps: [{ label: 'Find bug', status: 'done' }, { label: 'Patch', status: 'now' }] })
    expect(parseMission('no json here')).toBeUndefined()
    const auto = { ...EMPTY_AUTO, steps: parsed?.steps ?? [] }
    expect(stepsFor([], auto)).toHaveLength(2)
    expect(stepsFor([{ content: 'A', activeForm: 'Doing A', status: 'in_progress' }], auto)).toEqual([{ label: 'A', status: 'now' }])
  })

  test('the flow keeps the present in view and names what is next', async () => {
    const steps = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((label, i) => ({ label, status: (i < 3 ? 'done' : i === 3 ? 'now' : 'next') as 'done' | 'now' | 'next' }))
    const w = flowWindow(steps, 4)
    expect(w.shown.map(s => s.label)).toEqual(['c', 'd', 'e', 'f'])
    expect([w.before, w.after]).toEqual([2, 1])
    expect(nextLine(steps)).toBe('e, then f (+1)')
  })

  test('back-to-back reads fold into one row; failures stand alone', async () => {
    const base = { kind: 'read' as const, startedAt: 0, endedAt: 1 }
    const feed = [
      { ...base, id: '1', verb: 'Read', label: 'a.ts' },
      { ...base, id: '2', verb: 'Read', label: 'b.ts' },
      { ...base, id: '3', verb: 'Read', label: 'c.ts' },
      { id: '4', kind: 'run' as const, verb: 'Ran', label: 'npm test', startedAt: 0, endedAt: 1, isError: true },
    ]
    const groups = groupFeed(feed, 5)
    expect(groups.map(g => [g.verb, g.count])).toEqual([['Ran', 1], ['Read', 3]])
  })

  test('the why is the last thing Claude said before the call', async () => {
    expect(purposeFrom('Plan approved. Reading the **cards** to see the mission section:')).toBe('Reading the cards to see the mission section')
    expect(purposeFrom('```ts\ncode\n```')).toBeUndefined()
  })
})

describe('activity purpose and the flow', () => {
  test('each call carries what it was for, until its results come back', async ($, on) => {
    engine(on)
    on('tool.call', () => ({ result: {} }))
    const say = (text: string) =>
      $.session.append({ message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text }] }, door: 'response', origin: { kind: 'model', model: 'm' }, uuid: `u-${text.length}` } as never)
    await say('Checking the schema so the export knows each field.')
    await $.tool.call({ tool: 'Read', file_path: 'C:/repo/vault/schema.json' } as never)
    const ui = await $.ui.mount({ ...mount(160), surface: 'terminal' })
    await ui.press({ key: 'layout-rows' })
    expect(await ui.find({ text: /Checking the schema/ })).toBeUndefined()
    const row = (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('feed-') && /Read schema\.json/.test(b.text ?? ''))
    await ui.press({ key: row?.key ?? '' })
    expect(await ui.find({ text: /Checking the schema so the export knows each field/ })).toBeDefined()
    await ui.unmount()
  })

  test('older steps of the path scroll into view and back', async ($, on) => {
    engine(on)
    on('tool.call', () => ({ result: {} }))
    const names = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']
    await $.tool.call({
      tool: 'TodoWrite',
      todos: names.map((n, i) => ({ content: n, activeForm: `Doing ${n}`, status: i < 6 ? 'completed' : i === 6 ? 'in_progress' : 'pending' })),
    } as never)
    const ui = await $.ui.mount({ ...mount(160), surface: 'terminal' })
    await ui.press({ key: 'layout-rows' })
    expect(JSON.stringify(await ui.drawn())).not.toContain('"Two"')
    for (let i = 0; i < 3; i++) await ui.press({ key: 'flow-earlier' })
    expect(await ui.find({ key: 'flow-earlier' })).toBeUndefined()
    expect(JSON.stringify(await ui.drawn())).toContain('Two')
    expect(await ui.find({ key: 'flow-now' })).toBeDefined()
    await ui.press({ key: 'flow-now' })
    expect(await ui.find({ key: 'flow-later' })).toBeUndefined()
    await ui.unmount()
  })

  test('the track and the timeline draw the steps at full size on both surfaces', async ($, on) => {
    engine(on)
    on('tool.call', () => ({ result: {} }))
    await $.tool.call({
      tool: 'TodoWrite',
      todos: [
        { content: 'Parse vault', activeForm: 'Parsing vault', status: 'completed' },
        { content: 'Render markdown', activeForm: 'Rendering markdown', status: 'in_progress' },
        { content: 'Add tests', activeForm: 'Adding tests', status: 'pending' },
      ],
    })
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...mount(160), surface })
      for (const layout of ['rows', 'focus'] as const) {
        await ui.press({ key: `layout-${layout}` })
        const drawn = JSON.stringify(await ui.drawn())
        expect(drawn).toContain('Rendering markdown')
        expect(drawn).toContain('Add tests')
        // A picture on the desktop, fixed in size so it is never shrunk; a rail of text on the terminal.
        expect(drawn).toContain(surface === 'desktop' ? '"type":"Svg"' : '│')
      }
      await ui.unmount()
    }
  })
})

// A sweep over the whole command center: every layout, at narrow to wide
// widths, on the desktop and the terminal, with every card holding real
// content; then every button and icon it draws is pressed. Any tree the
// surface refuses, any press that throws, or any rejection left unhandled
// fails it.

const HOME = 'C:/home'
const NOW = Date.parse('2026-10-11T14:00:00Z')
const card = (pid: number, sessionId: string, cwd: string, status: string) =>
  JSON.stringify({ pid, sessionId, cwd, entrypoint: 'cli', status, updatedAt: NOW - 60_000, statusUpdatedAt: NOW - 30_000, name: 'other work' })
const transcript = (prompt: string) =>
  [
    JSON.stringify({ type: 'user', cwd: 'C:\\proj\\app', message: { role: 'user', content: prompt } }),
    JSON.stringify({ type: 'assistant', message: { usage: { cache_creation: { ephemeral_1h_input_tokens: 900, ephemeral_5m_input_tokens: 0 } } } }),
  ].join('\n')

// A small machine: this session, one other busy one, two past transcripts.
const FILES: Record<string, string> = {
  [`${HOME}/.claude/sessions/111.json`]: card(111, 's-here', 'C:\\proj\\app', 'idle'),
  [`${HOME}/.claude/sessions/222.json`]: card(222, 's-other', 'C:\\proj\\app', 'busy'),
  [`${HOME}/.claude/projects/C--proj-app/s-here.jsonl`]: transcript('Build the command center'),
  [`${HOME}/.claude/projects/C--proj-app/s-other.jsonl`]: transcript('Fix the exporter'),
  [`${HOME}/.claude/projects/C--proj-app/s-old.jsonl`]: transcript('An old experiment with charts'),
}
const DIRS: Record<string, { kind: 'file' | 'dir'; name: string; mtimeMs: number; size: number }[]> = {
  [`${HOME}/.claude/sessions`]: [
    { kind: 'file', name: '111.json', mtimeMs: NOW, size: 200 },
    { kind: 'file', name: '222.json', mtimeMs: NOW, size: 200 },
  ],
  [`${HOME}/.claude/projects`]: [{ kind: 'dir', name: 'C--proj-app', mtimeMs: NOW, size: 0 }],
  [`${HOME}/.claude/projects/C--proj-app`]: [
    { kind: 'file', name: 's-here.jsonl', mtimeMs: NOW - 2 * 60_000, size: 4000 },
    { kind: 'file', name: 's-other.jsonl', mtimeMs: NOW - 60_000, size: 9000 },
    { kind: 'file', name: 's-old.jsonl', mtimeMs: NOW - 40 * 86_400_000, size: 2000 },
  ],
}
const norm = (p: string) => p.replace(/\\/g, '/')

// What the plugin asked of the engine, in order, for the tests to check.
type Call = { event: string; e: Record<string, unknown> }

// PowerShell -EncodedCommand is base64 of UTF-16LE; read the script back.
function decodePs(b64: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const ch of b64.replace(/=+$/, '')) {
    value = (value << 6) | alphabet.indexOf(ch)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }
  let out = ''
  for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8))

  return out
}

// A fake disk the move and remove scripts really change: a transcript moved
// to trash leaves its folder and appears in the trash; emptying deletes it.
// Set by a test to make agent starts be refused.
const spawnFails = { on: false }

function machine(on: On, log: Call[] = []) {
  const clock = mock.clock(on, { now: NOW } as never)
  mock.store(on)
  mock.env(on, { USERPROFILE: HOME, OS: 'Windows_NT' })
  const files: Record<string, string> = { ...FILES }
  const dirs: Record<string, { kind: 'file' | 'dir'; name: string; mtimeMs: number; size: number }[]> = JSON.parse(JSON.stringify(DIRS))
  const ok = (value: unknown) => ({ value }) as never
  const record = (event: string, e: unknown) => log.push({ event, e: e as Record<string, unknown> })
  const parent = (path: string) => path.slice(0, path.lastIndexOf('/'))
  const base = (path: string) => path.slice(path.lastIndexOf('/') + 1)
  const fromScript = (script: string, name: string) => {
    const m = script.match(new RegExp(`\\$${name}='([^']*)'`))
    return m ? norm(m[1]?.replace(/^\\\\\?\\/, '') ?? '') : undefined
  }
  const move = (from: string, dest: string) => {
    const entry = dirs[parent(from)]?.find(x => x.name === base(from))
    if (!entry) throw new Error(`no such file: ${from}`)
    dirs[parent(from)] = (dirs[parent(from)] ?? []).filter(x => x !== entry)
    dirs[parent(dest)] = [...(dirs[parent(dest)] ?? []), { ...entry, name: base(dest) }]
    if (files[from] !== undefined) files[dest] = files[from] ?? ''
    delete files[from]
  }

  // Only the fake home answers; anything else (the harness's own reads)
  // goes on to the layers beneath.
  const mine = (e: unknown) => norm(String((e as { path?: string }).path ?? '')).startsWith(HOME)
  on('fs.list', (_$, e, next) => {
    if (!mine(e)) return next(e as never)
    const list = dirs[norm((e as { path: string }).path)]
    if (!list) throw new Error(`no such folder: ${(e as { path: string }).path}`)
    return ok(list)
  })
  on('fs.read', (_$, e, next) => {
    if (!mine(e)) return next(e as never)
    const text = files[norm((e as { path: string }).path)]
    if (text === undefined) throw new Error(`no such file: ${(e as { path: string }).path}`)
    return ok(text)
  })
  on('fs.stat', (_$, e, next) => {
    if (!mine(e)) return next(e as never)
    const path = norm((e as { path: string }).path)
    if (files[path] === undefined) throw new Error(`no such file: ${path}`)
    return ok({ kind: 'file', size: files[path]?.length ?? 0, mtimeMs: NOW - 2 * 60_000, isLink: false })
  })
  on('fs.exists', (_$, e, next) => {
    if (!mine(e)) return next(e as never)
    const path = norm((e as { path: string }).path)
    const isInside = Object.keys(dirs).some(d => d.startsWith(`${path}/`))
    return ok(files[path] !== undefined || dirs[path] !== undefined || isInside || (dirs[parent(path)] ?? []).some(x => x.name === base(path)))
  })
  on('fs.write', (_$, e, next) => {
    if (!mine(e)) return next(e as never)
    record('fs.write', e)
    return ok(undefined)
  })
  on('process.run', (_$, e) => {
    const text = JSON.stringify(e)
    if (text.includes('tasklist')) return ok({ exitCode: 0, stdout: '"claude.exe","111","Console","1","1 K"\n"claude.exe","222","Console","1","1 K"\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false })
    const argv = ((e as { argv?: string[] }).argv ?? (e as { command?: string[] }).command ?? []) as string[]
    const encoded = argv[argv.indexOf('-EncodedCommand') + 1]
    const script = encoded ? decodePs(encoded) : ''
    record('process.run', { argv })
    record('script', { script })
    try {
      const from = fromScript(script, 'from')
      const dest = fromScript(script, 'dest')
      if (from && dest) move(from, dest)
      const removed = script.match(/Directory\]::Delete\('([^']*)'/)?.[1]
      if (removed) {
        const root = norm(removed.replace(/^\\\\\?\\/, ''))
        for (const key of Object.keys(dirs)) if (key.startsWith(root)) delete dirs[key]
        for (const key of Object.keys(files)) if (key.startsWith(root)) delete files[key]
      }
    } catch (err) {
      return ok({ exitCode: 1, stdout: '', stderr: String(err), isStdoutTruncated: false, isStderrTruncated: false })
    }
    return ok({ exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false })
  })
  on('session.id', () => ok('s-here'))
  on('session.messages', () => ok([{ role: 'user', text: 'Build the command center', toolUses: [] }]))
  on('session.usage', () =>
    ok({ startedAt: NOW - 3_600_000, context: { percent: 37 }, rateLimits: [{ kind: 'five_hour', percentUsed: 20, resetsAt: new Date(NOW + 2 * 3_600_000).toISOString() }, { kind: 'seven_day', percentUsed: 63, resetsAt: new Date(NOW + 3 * 86_400_000).toISOString() }] }),
  )
  on('model.complete', () => ok({ text: JSON.stringify({ mission: 'Ship the command center', steps: ['Draw it', 'Test it', 'Share it'] }) }))
  on('agent.list', () => ok([{ id: 'a1', description: 'Scout the notes', type: 'command-center:scout', status: 'running' }]))
  on('agent.spawn', (_$, e) => {
    record('agent.spawn', e)
    if (spawnFails.on) return { deny: 'agents are off here' } as never
    return { model: String((e as { model?: string }).model ?? 'haiku'), agentId: 'a2' } as never
  })
  // A prompt sent from the pane goes no further than this test.
  on('prompt.submit', (_$, e) => (record('prompt.submit', e), { drop: 'test' }) as never)
  // Commands the engine owns stop here; the plugin's own go on to it.
  on('command.run', (_$, e, next) => {
    const name = (e as { command: string }).command
    if (name === 'clear' || name === 'compact') return (record('command.run', e), ok({ text: '' }))
    return next(e as never)
  })
  on('ui.copy', (_$, e) => (record('ui.copy', e), ok({ isCopied: true })))
  on('ui.open', (_$, e) => (record('ui.open', e), ok({ isPlaced: true })))
  on('ui.close', (_$, e) => (record('ui.close', e), ok(undefined)))
  on('ui.toast', (_$, e) => (record('ui.toast', e), ok(undefined)))
  on('ui.status', () => ok(undefined))
  on('ui.notify', (_$, e) => (record('ui.notify', e), ok({ isSent: true, channel: 'test' })))

  return clock
}

// The engine interface a test body gets; only tool.call and session.measure are used.
async function seed($: { tool: { call: (args: never) => Promise<unknown> }; session: { measure: (args: never) => Promise<unknown> } }) {
  await $.tool.call({
    tool: 'TodoWrite',
    todos: ['Sketch', 'Draw it', 'Test it', 'Share it', 'Polish', 'Ship'].map((c, i) => ({ content: c, activeForm: `${c}…`, status: i < 3 ? 'completed' : i === 3 ? 'in_progress' : 'pending' })),
  } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test\nnpm run lint', description: 'Run the tests' } as never)
  await $.tool.call({ tool: 'Read', file_path: 'C:/proj/app/src/cards.tsx' } as never)
  await $.session.measure({
    context: { window: 200_000, percent: 37 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 82, resetsAt: new Date(NOW + 2 * 3_600_000).toISOString() },
      { kind: 'seven_day', percentUsed: 63, resetsAt: new Date(NOW + 3 * 86_400_000).toISOString() },
    ],
    changed: ['context', 'rateLimits'],
  } as never)
}

type El = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
function buttonKeys(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out
  const el = node as El
  if (el.type === 'Button' && typeof el.props?.key === 'string') out.push(el.props.key)
  for (const child of el.children ?? []) buttonKeys(child, out)

  return out
}

const PANE = (bodyColumns: number) => ({
  plugin: 'command-center',
  component: 'Pane' as const,
  requestId: 'command-center',
  props: { title: 'Command center', isFocused: false, bodyColumns, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 60 }, view: {} },
})

const LAYOUTS = ['rows', 'columns', 'strip', 'focus'] as const
const WIDTHS = [45, 80, 110, 160]

describe('sweep', () => {
  for (const surface of ['desktop', 'terminal'] as const) {
    for (const width of WIDTHS) {
      // About 200 presses each: more than the default 5 seconds.
      test(`${surface} at ${width} columns: every layout draws and every control presses`, { timeoutMs: 30_000 }, async ($, on) => {
        machine(on)
        on('tool.call', (_$, e) => ((e as { tool: string }).tool === 'Bash' ? { isError: true, result: 'lint failed' } : { result: {} }) as never)
        on('session.measure', (_$, e) => ({ changed: e.changed }))
        await seed($)
        const ui = await $.ui.mount({ ...PANE(width), surface } as never)
        // Fill the sessions lists and helpers the way Refresh does.
        await ui.press({ key: 'refresh-all' })

        const problems: string[] = []
        for (const layout of LAYOUTS) {
          await ui.press({ key: `layout-${layout}` })
          let tree
          try {
            tree = await ui.drawn()
          } catch (err) {
            problems.push(`${layout}: refused: ${String(err)}`)
            continue
          }
          const keys = [...new Set(buttonKeys(tree))]
          expect(keys.length).toBeGreaterThan(5)
          for (const key of keys) {
            // Keys can leave as others are pressed (a tab switches, a row folds).
            if (!(await ui.find({ key }))) continue
            try {
              await ui.press({ key })
              await ui.drawn()
            } catch (err) {
              problems.push(`${layout} › ${key}: ${String(err).split('\n')[0]}`)
            }
          }
          // Back to this layout's start for the next one.
          await ui.press({ key: `layout-${layout}` })
        }
        expect(problems).toEqual([])
        await ui.unmount()
      })
    }
  }
})



describe('polish', () => {
  // Every Box laid over a drawing to make it pressable holds one row only.
  const overlays = (node: unknown, out: number[] = []): number[] => {
    if (!node || typeof node !== 'object') return out
    const el = node as El
    if (el.type === 'Box' && el.props?.position === 'absolute') out.push((el.children ?? []).filter(c => (c as El)?.type === 'Button').length)
    for (const child of el.children ?? []) overlays(child, out)

    return out
  }

  test('strip lists the limits as rows and focus frames them as rings, at 150 columns', async ($, on) => {
    machine(on, [])
    on('tool.call', () => ({ result: {} }) as never)
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    await seed($)
    const ui = await $.ui.mount({ ...PANE(150), surface: 'desktop' } as never)

    await ui.press({ key: 'layout-strip' })
    // Rows: the 5h name and its reset sit together; the weekly row is short.
    expect(await ui.find({ text: /^5h {2}resets \d/ })).toBeDefined()
    expect(await ui.find({ text: /^Weekly {2}(on pace|pace [+\u2212]\d+%)$/ })).toBeDefined()
    // The counts are figures, and the actions share a framed bar with the note.
    expect(await ui.find({ text: /^\d+ runs?$/ })).toBeDefined()
    expect(await ui.find({ key: 'note-send-draft' })).toBeDefined()
    expect(Math.max(0, ...overlays(await ui.drawn()))).toBeLessThanOrEqual(1)

    await ui.press({ key: 'layout-focus' })
    // Rings, each name pressable, inside a Limits card with the actions.
    expect(await ui.find({ key: 'gauge-name-Weekly' })).toBeDefined()
    expect(await ui.find({ key: 'gauge-note-Weekly' })).toBeDefined()
    expect(await ui.find({ key: 'act-recap' })).toBeDefined()
    expect(Math.max(0, ...overlays(await ui.drawn()))).toBeLessThanOrEqual(1)
    await ui.unmount()
  })

  test('the glance above the prompt draws and every control presses, closed and open', async ($, on) => {
    machine(on, [])
    on('tool.call', () => ({ result: {} }) as never)
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    await seed($)
    for (const surface of ['desktop', 'terminal'] as const) {
      for (const bodyColumns of [60, 120, 180]) {
        const ui = await $.ui.mount({ plugin: 'command-center', component: 'AbovePrompt', surface, props: { hasSurvey: false, isWorking: true, maxRows: 30, bodyColumns, scroll: { offset: 0, bodyRows: 30 } } } as never)
        await ui.press({ key: 'glance-more' })
        const keys = [...new Set(buttonKeys(await ui.drawn()))].filter(k => k !== 'glance-hide')
        expect(keys.length).toBeGreaterThan(3)
        for (const key of keys) {
          if (!(await ui.find({ key }))) continue
          await ui.press({ key })
          await ui.drawn()
        }
        await ui.unmount()
      }
    }
  })
})

describe('features end to end', () => {
  const run = ($: unknown, command: string, args = '') =>
    ($ as { command: { run: (a: never) => Promise<{ text?: string }> } }).command.run({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } } as never)
  const keysLike = async (ui: { drawn: () => Promise<unknown> }, prefix: string) => buttonKeys(await ui.drawn()).filter(k => k.startsWith(prefix))
  const setup = async ($: Parameters<typeof seed>[0], on: On) => {
    const log: Call[] = []
    machine(on, log)
    on('tool.call', (_$, e) => ((e as { tool: string }).tool === 'Bash' ? { isError: true, result: 'lint failed' } : { result: {} }) as never)
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    on('turn.complete', (_$, e) => ({ text: (e as { answer: string }).answer }) as never)
    await seed($)

    return log
  }
  const of = (log: Call[], event: string) => log.filter(c => c.event === event).map(c => c.e)
  // The desktop drawing has fields and selects; the mount's type is general.
  type Fields = { input: (t: { key: string; text: string; kind: 'change' | 'submit' }) => Promise<unknown>; select: (t: { key: string; value: string }) => Promise<unknown> }
  const fields = (ui: unknown) => ui as Fields

  test('every slash command does what it says', async ($, on) => {
    const log = await setup($, on)
    // /cc off closes the pane; /cc opens it again; anything else explains.
    expect((await run($, 'cc', 'off')).text).toMatch(/^Command center closed/)
    expect(of(log, 'ui.close').at(-1)).toMatchObject({ id: 'command-center' })
    expect((await run($, 'cc', 'sideways')).text).toBe('Usage: /cc to open the command center, /cc off to close it.')
    expect((await run($, 'cc')).text).toBe('Command center opened.')
    expect(of(log, 'ui.open').at(-1)).toMatchObject({ id: 'command-center' })
    expect((await run($, 'cc-layout', 'columns')).text).toMatch(/columns/i)
    expect((await run($, 'cc-layout', 'sideways')).text).toBe('Layouts: rows, columns, strip, focus.')
    expect((await run($, 'cc-glance', 'banana')).text).toBe('Usage: /cc-glance on | off')
    expect((await run($, 'cc-glance', 'off')).text).toMatch(/off|hidden/i)
    expect((await run($, 'mission', 'Ship v1')).text).toBe('Mission pinned: Ship v1')
    expect((await run($, 'note', '')).text).toBe('Usage: /note <text>')
    expect((await run($, 'note', 'Remember the README')).text).toMatch(/saved|note/i)
    await run($, 'spawn', 'tester run the unit tests')
    const spawned = of(log, 'agent.spawn')
    expect(spawned).toHaveLength(1)
    expect(spawned[0]).toMatchObject({ subagent_type: 'command-center:tester', model: 'sonnet', prompt: 'run the unit tests' })
    await run($, 'spawn', 'find where notes are written')
    expect(of(log, 'agent.spawn')[1]).toMatchObject({ subagent_type: 'command-center:scout', prompt: 'find where notes are written' })
    expect((await run($, 'cc-action', 'add Deploy | ship it to staging')).text).toMatch(/Deploy/)
    expect((await run($, 'cc-action', 'list')).text).toMatch(/Deploy/)

    const ui = await $.ui.mount({ ...PANE(160), surface: 'desktop' } as never)
    // /cc-layout columns took: the Columns layout's own cards are there.
    expect(await ui.find({ text: 'Quick actions' })).toBeDefined()
    expect(await ui.find({ text: /Ship v1/ })).toBeDefined()
    // The custom action is a pill that sends its prompt.
    await ui.press({ key: 'act-custom-0' })
    expect(of(log, 'prompt.submit').at(-1)).toMatchObject({ text: 'ship it to staging' })
    await ui.unmount()

    expect((await run($, 'cc-action', 'remove Deploy')).text).toMatch(/Deploy|removed/i)
    expect((await run($, 'mission', '')).text).toMatch(/clear|auto|derived/i)
  })

  test('a session goes to trash, comes back, old ones clean up, and the trash empties', async ($, on) => {
    const log = await setup($, on)
    const ui = await $.ui.mount({ ...PANE(160), surface: 'desktop' } as never)
    await ui.press({ key: 'layout-rows' })
    await ui.press({ key: 'refresh-all' })
    await ui.press({ key: 'tab-past' })
    // The running sessions cannot be deleted; the old one can.
    expect(await ui.find({ key: 'del-s-other' })).toBeUndefined()
    expect(await ui.find({ key: 'del-s-old' })).toBeDefined()

    await ui.press({ key: 'del-s-old' })
    expect(await ui.find({ key: 'confirm-del-s-old-yes' })).toBeDefined()
    await ui.press({ key: 'confirm-del-s-old-yes' })
    expect(of(log, 'script').some(c => String(c.script).includes('s-old.jsonl') && String(c.script).includes('[IO.File]::Move'))).toBe(true)
    expect(await ui.find({ key: 'del-s-old' })).toBeUndefined()
    expect(of(log, 'ui.toast').some(c => /Moved to trash/.test(String(c.text)))).toBe(true)

    await ui.press({ key: 'tab-trash' })
    const restore = (await keysLike(ui, 'restore-'))[0]
    expect(restore).toBeDefined()
    await ui.press({ key: restore ?? '' })
    expect(await ui.find({ text: /Trash is empty/ })).toBeDefined()
    await ui.press({ key: 'tab-past' })
    expect(await ui.find({ key: 'del-s-old' })).toBeDefined()

    // Older than 30 days: the same session, in one go.
    await ui.press({ key: 'cleanup-old' })
    await ui.press({ key: 'confirm-cleanup-yes' })
    expect(of(log, 'ui.toast').some(c => /Moved 1 old session to trash/.test(String(c.text)))).toBe(true)
    expect(await ui.find({ key: 'del-s-old' })).toBeUndefined()

    await ui.press({ key: 'tab-trash' })
    await ui.press({ key: 'empty-trash' })
    await ui.press({ key: 'confirm-empty-yes' })
    expect(of(log, 'script').some(c => /Directory\]::Delete/.test(String(c.script)))).toBe(true)
    expect(await ui.find({ text: /Trash is empty/ })).toBeDefined()
    await ui.unmount()
  })

  test('clearing this chat asks first, then runs /clear', async ($, on) => {
    const log = await setup($, on)
    const ui = await $.ui.mount({ ...PANE(160), surface: 'desktop' } as never)
    await ui.press({ key: 'layout-rows' })
    await ui.press({ key: 'refresh-all' })
    await ui.press({ key: 'clear-here' })
    expect(of(log, 'command.run')).toHaveLength(0)
    await ui.press({ key: 'confirm-clear-no' })
    expect(await ui.find({ key: 'confirm-clear-yes' })).toBeUndefined()
    await ui.press({ key: 'clear-here' })
    await ui.press({ key: 'confirm-clear-yes' })
    expect(of(log, 'command.run').at(-1)).toMatchObject({ command: 'clear' })
    await ui.unmount()
  })

  test('notes save, send, write the notes file, and delete', async ($, on) => {
    const log = await setup($, on)
    const ui = await $.ui.mount({ ...PANE(160), surface: 'desktop' } as never)
    await ui.press({ key: 'layout-rows' })
    await fields(ui).input({ key: 'note-draft-0', text: 'Check the trash path', kind: 'submit' })
    expect(await ui.find({ text: /Check the trash path/ })).toBeDefined()
    expect(of(log, 'fs.write').some(c => String(c.path).endsWith('command-center-notes.md') && JSON.stringify(c).includes('Check the trash path'))).toBe(true)
    const send = (await keysLike(ui, 'note-send-')).find(k => k !== 'note-send-draft')
    await ui.press({ key: send ?? '' })
    expect(of(log, 'prompt.submit').at(-1)).toMatchObject({ text: 'Check the trash path' })
    // Save & send: typed, never redrawn mid-word, then saved and sent.
    await fields(ui).input({ key: 'note-draft-1', text: 'Ask about pacing', kind: 'change' })
    await ui.press({ key: 'note-send-draft' })
    expect(of(log, 'prompt.submit').at(-1)).toMatchObject({ text: 'Ask about pacing' })
    expect(await ui.find({ key: 'note-draft-2' })).toBeDefined()
    // Delete both.
    for (const del of await keysLike(ui, 'note-del-')) await ui.press({ key: del })
    expect(await keysLike(ui, 'note-del-')).toHaveLength(0)
    await ui.unmount()
  })

  test('a helper starts from the Agents card with the chosen kind', async ($, on) => {
    const log = await setup($, on)
    const ui = await $.ui.mount({ ...PANE(160), surface: 'desktop' } as never)
    await ui.press({ key: 'layout-rows' })
    await fields(ui).select({ key: 'spawn-helper', value: 'scribe' })
    await fields(ui).input({ key: 'spawn-input', text: 'Draft release notes', kind: 'submit' })
    expect(of(log, 'agent.spawn').at(-1)).toMatchObject({ subagent_type: 'command-center:scribe', model: 'haiku', prompt: 'Draft release notes' })
    await ui.unmount()
  })

  test('a helper that fails to start says so', async ($, on) => {
    const log = await setup($, on)
    spawnFails.on = true
    try {
      await run($, 'spawn', 'scout look around')
    } finally {
      spawnFails.on = false
    }
    expect(of(log, 'ui.toast').some(c => /Couldn't start Scout: agents are off here/.test(String(c.text)))).toBe(true)
  })

  test('an activity row copies its whole command and asks for an explanation', async ($, on) => {
    const log = await setup($, on)
    const ui = await $.ui.mount({ ...PANE(160), surface: 'desktop' } as never)
    await ui.press({ key: 'layout-rows' })
    const rows = (await keysLike(ui, 'feed-')).filter(k => !/^feed-(icon|chevron|copy|explain|close)-/.test(k))
    // Open each row until the one with the command shows Copy command.
    let copied = false
    for (const row of rows) {
      await ui.press({ key: row })
      const copy = (await keysLike(ui, 'feed-copy-'))[0]
      if (!copy) continue
      await ui.press({ key: copy })
      copied = true
      break
    }
    expect(copied).toBe(true)
    expect(of(log, 'ui.copy').at(-1)).toMatchObject({ text: 'npm test\nnpm run lint' })
    const explain = (await keysLike(ui, 'feed-explain-'))[0]
    await ui.press({ key: explain ?? '' })
    expect(String(of(log, 'prompt.submit').at(-1)?.text)).toMatch(/^In two or three sentences: what did "/)
    await ui.unmount()
  })

  test('limit alerts speak once per crossing, and a long turn notifies when done', async ($, on) => {
    const log = await setup($, on)
    const at = (pct: number) =>
      $.session.measure({ context: { window: 200_000, percent: 30 }, rateLimits: [{ kind: 'five_hour', percentUsed: pct, resetsAt: new Date(NOW + 3_600_000).toISOString() }], changed: ['rateLimits'] } as never)
    const alerts = () => of(log, 'ui.toast').filter(c => /five_hour usage is at/.test(String(c.text))).length
    const before = alerts()
    await at(91)
    await at(93)
    expect(alerts() - before).toBe(1)
    await at(50)
    await at(92)
    expect(alerts() - before).toBe(2)

    await $.turn.complete({ answer: 'ok', durationMs: 2_000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
    expect(of(log, 'ui.notify')).toHaveLength(0)
    await $.turn.complete({ answer: 'ok', durationMs: 125_000, isAborted: false, turnId: 't2', reason: 'answer' } as never)
    expect(of(log, 'ui.notify').at(-1)).toMatchObject({ text: 'Done in 2m' })
  })
})

describe('sessions card', () => {
  const opened = async ($: Parameters<typeof seed>[0], on: On) => {
    const log: Call[] = []
    machine(on, log)
    on('tool.call', () => ({ result: {} }) as never)
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    await seed($)

    return log
  }
  const of = (log: Call[], event: string) => log.filter(c => c.event === event).map(c => c.e)
  const hasBackground = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    const el = node as El
    if (el.type === 'Text' && el.props?.backgroundColor !== undefined) return true

    return (el.children ?? []).some(hasBackground)
  }

  test('a live session opens its details: folder, where it runs, resume and open folder', async ($, on) => {
    const log = await opened($, on)
    const ui = await $.ui.mount({ ...PANE(160), surface: 'desktop' } as never)
    await ui.press({ key: 'layout-rows' })
    await ui.press({ key: 'refresh-all' })
    // No status label sits on a background box.
    expect(hasBackground(await ui.drawn())).toBe(false)
    // Clear has left the table for the card's own last row.
    expect(await ui.find({ key: 'clear-here' })).toBeDefined()

    await ui.press({ key: 'session-s-other' })
    expect(await ui.find({ text: 'Folder  C:\\proj\\app' })).toBeDefined()
    expect(await ui.find({ text: /^Runs in {2}a terminal · process 222$/ })).toBeDefined()
    await ui.press({ key: 'session-copy-s-other' })
    expect(of(log, 'ui.copy').at(-1)).toMatchObject({ text: 'cd "C:\\proj\\app"; claude --resume s-other' })
    // Open folder asks the Windows shell to show it (a hidden process's own
    // explorer.exe opened invisibly), with the path quoted for PowerShell.
    await ui.press({ key: 'session-folder-s-other' })
    expect(of(log, 'script').some(c => String(c.script).includes('Shell.Application') && String(c.script).includes("Explore('C:\\proj\\app')"))).toBe(true)
    expect(of(log, 'process.run').some(c => JSON.stringify(c).includes('"explorer"'))).toBe(false)
    // A running session's trash button explains instead of moving a file in use.
    await ui.press({ key: 'live-del-s-other' })
    expect(of(log, 'ui.toast').at(-1)).toMatchObject({ text: 'other work is still open in a terminal. Close it there, then trash it from Past.' })
    expect(of(log, 'script').filter(c => String(c.script).includes('Move('))).toHaveLength(0)
    // The icon opens and closes it too.
    await ui.press({ key: 'session-icon-s-other' })
    expect(await ui.find({ key: 'session-copy-s-other' })).toBeUndefined()

    // This session's details offer Clear, not a resume of itself.
    await ui.press({ key: 'session-here' })
    expect(await ui.find({ key: 'clear-here-details' })).toBeDefined()
    expect(await ui.find({ key: 'session-copy-here' })).toBeUndefined()
    await ui.unmount()
  })

  test('a past session opens its details with its own folder in the resume command', async ($, on) => {
    const log = await opened($, on)
    const ui = await $.ui.mount({ ...PANE(160), surface: 'desktop' } as never)
    await ui.press({ key: 'layout-rows' })
    await ui.press({ key: 'refresh-all' })
    await ui.press({ key: 'tab-past' })
    await ui.press({ key: 'past-s-old' })
    expect(await ui.find({ text: 'An old experiment with charts' })).toBeDefined()
    await ui.press({ key: 'past-copy-s-old' })
    expect(of(log, 'ui.copy').at(-1)).toMatchObject({ text: 'cd "C:\\proj\\app"; claude --resume s-old' })
    await ui.press({ key: 'session-close-past-s-old' })
    expect(await ui.find({ key: 'past-copy-s-old' })).toBeUndefined()
    await ui.unmount()
  })
})
