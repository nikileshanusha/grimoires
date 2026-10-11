import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { encodePs, moveFailure, moveScript, olderThan } from '../hooks/cleanup'
import { eta, median, mergeLimits, mergeTodos, statusLine, toResetIso } from '../hooks/eta'
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
    expect(describeTranscript(lines)).toEqual({ title: 'Fix the login flow', project: 'margins' })
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
    const calm = { context: 32, fiveHour: { percent: 11, resetsAt }, week: 61, cacheLeftMs: 50 * 60_000, helpers: 0, now }
    expect(statusLine(calm)).toBe('ctx 32% | 5h 11% | 7d 61%')
    expect(statusLine({ ...calm, fiveHour: { percent: 82, resetsAt } })).toBe('ctx 32% | 5h 82% until 4:30p | 7d 61%')
    expect(statusLine({ ...calm, cacheLeftMs: 4 * 60_000 })).toBe('ctx 32% | 5h 11% | 7d 61% | cache 4m left')
    expect(statusLine({ ...calm, cacheLeftMs: 0 })).toBe('ctx 32% | 5h 11% | 7d 61% | cache cold')
    // Never more than four items, whatever is going on.
    expect(statusLine({ ...calm, cacheLeftMs: 0, helpers: 2, etaLeftMs: 6 * 60_000 }).split(' | ')).toHaveLength(4)
    expect(statusLine({ helpers: 0, now })).toBe('command center')
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
    expect(await ui.find({ text: /0 edits · 1 run · 1 error/ })).toBeDefined()
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
    expect(await ui.find({ text: /5h ↻ \d/ })).toBeDefined()
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
    expect(await ui.find({ key: 'gauge-ring-5h' })).toBeDefined()

    // The ring, with its figure inside, says what it means.
    await ui.press({ key: 'gauge-ring-5h' })
    expect(toasts.some(t => /^5h limit: 6% used\. Resets .+\(in 2h 0m\)\.$/.test(t))).toBe(true)

    const line = statuses.filter(Boolean).pop() ?? ''
    expect(line).toContain('|')
    // One lean line: the reset as a short clock time, no line breaks.
    expect(line).toBe('ctx 28% | 5h 6% | 7d 61%')
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
    expect(await ui.find({ text: /^5h {2}↻ \d/ })).toBeDefined()
    expect(await ui.find({ text: /^Weekly {2}↻ \d/ })).toBeDefined()
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
