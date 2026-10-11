import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow, CustomAction, FeedItem, Layout, Limit, LiveSession, Note, PastSession, ToolKind, TrashItem, View } from '../types'
import { Glance, makeKit } from './cards'
import { EMPTY_AUTO, MISSION_SYSTEM, missionPrompt, parseMission, purposeFrom } from './mission'
import type { Data } from './cards'
import { encodePs, moveFailure, moveScript, olderThan, removeScript } from './cleanup'
import type { Script } from './cleanup'
import { blendMedian, eta, fmtDuration, fmtTimeOfDay, mergeLimits, mergeTodos, toResetIso } from './eta'
import { Pane } from './layouts'
import { BUILT_IN_ACTIONS, HELPERS, PANE, TITLE } from './ops'
import type { Act, Helper } from './ops'
import { CACHE_5M, basename, cacheLeft, cacheTtlOf, describeTranscript, parentOf, parseCard, parsePids, projectFromDir, sortLive, transcriptPath } from './sessions'
import { DEFAULT_VIEW, STORE } from './state'

// The session's values: each pane read subscribes to them.
const goal = atom({ plugin: 'command-center', key: 'goal' } as const, '')
const todos = atom({ plugin: 'command-center', key: 'todos' } as const, [])
const feed = atom({ plugin: 'command-center', key: 'feed' } as const, [])
const counts = atom({ plugin: 'command-center', key: 'counts' } as const, { edits: 0, runs: 0, errors: 0 })
const measure = atom({ plugin: 'command-center', key: 'measure' } as const, { limits: [] })
const turnStartedAt = atom({ plugin: 'command-center', key: 'turnStartedAt' } as const, 0)
const agents = atom({ plugin: 'command-center', key: 'agents' } as const, [])
const live = atom({ plugin: 'command-center', key: 'live' } as const, [])
const past = atom({ plugin: 'command-center', key: 'past' } as const, [])
const trash = atom({ plugin: 'command-center', key: 'trash' } as const, [])
const auto = atom({ plugin: 'command-center', key: 'auto' } as const, EMPTY_AUTO)
const draftGen = atom({ plugin: 'command-center', key: 'draftGen' } as const, 0)
// What is typed in the note field lives here, not in state: a state write
// on every key would redraw the pane and redraw the field under the cursor.
let typed = ''
const notes = atom({ plugin: 'command-center', key: 'notes' } as const, [])
const actions = atom({ plugin: 'command-center', key: 'actions' } as const, [])
const tick = atom({ plugin: 'command-center', key: 'tick' } as const, 0)
const view = atom({ plugin: 'command-center', key: 'view' } as const, DEFAULT_VIEW)

const LAYOUT_IDS: Layout[] = ['rows', 'columns', 'strip', 'focus']


// ── Small readers ──────────────────────────────────────────────────────────

async function stored<T>($: EngineInterface, key: string, fallback: T): Promise<T> {
  try {
    const value = await $.store.get(key)

    return value === undefined || value === null ? fallback : (value as T)
  } catch {
    return fallback
  }
}

async function homeDir($: EngineInterface): Promise<string> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  if (home) return home.replace(/\\/g, '/')
  // The mod itself lives under ~/.claude, so its root names home as well.
  const root = $.plugin.root.replace(/\\/g, '/')

  return root.slice(0, root.indexOf('/.claude/'))
}

async function isWindows($: EngineInterface): Promise<boolean> {
  return (await $.env.get('OS')) === 'Windows_NT'
}

// Runs a move or remove script; `error` says why one failed.
async function runScript($: EngineInterface, script: Script): Promise<{ ok: boolean; error: string }> {
  try {
    const run = (await isWindows($))
      ? await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodePs(script.ps)], { timeoutMs: 30_000 })
      : await $.process.run(script.sh, { timeoutMs: 30_000 })

    return { ok: run.exitCode === 0, error: run.stderr.trim() || run.stdout.trim() }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ── Sessions across the machine ────────────────────────────────────────────

async function livePids($: EngineInterface): Promise<Set<number> | undefined> {
  try {
    const run = (await isWindows($))
      ? await $.process.run(['tasklist', '/FO', 'CSV', '/NH'], { timeoutMs: 8000 })
      : await $.process.run(['ps', '-A', '-o', 'pid='], { timeoutMs: 8000 })

    return run.exitCode === 0 ? parsePids(run.stdout) : undefined
  } catch {
    return undefined
  }
}

// Every Claude Code process, wherever it runs (a terminal, an IDE, the
// desktop app), keeps a card in ~/.claude/sessions/<pid>.json while it lives.
async function refreshLive($: EngineInterface): Promise<LiveSession[]> {
  const dir = `${await homeDir($)}/.claude/sessions`
  const hereId = await $.session.id()
  let entries
  try {
    entries = await $.fs.list(dir)
  } catch {
    return []
  }
  const alive = await livePids($)
  const rows: LiveSession[] = []
  for (const entry of entries) {
    if (entry.kind !== 'file' || !/^\d+\.json$/.test(entry.name)) continue
    try {
      const row = parseCard(await $.fs.read(`${dir}/${entry.name}`), entry.mtimeMs, hereId, alive)
      if (row) rows.push(row)
    } catch {
      // A card mid-write; the next poll picks it up.
    }
  }
  const home = await homeDir($)
  let dirs: string[] = []
  try {
    dirs = (await $.fs.list(`${home}/.claude/projects`)).filter(d => d.kind === 'dir').map(d => d.name)
  } catch {
    // No projects yet.
  }
  for (const row of rows) {
    if (!row.sessionId || !row.cwd) continue
    const path = transcriptPath(home, row.cwd, row.sessionId, dirs)
    try {
      const stat = await $.fs.stat(path)
      row.lastAt = stat.mtimeMs
      row.cacheTtlMs = await ttlFor($, path, stat.size)
    } catch {
      // No transcript yet: nothing has been cached either.
    }
  }
  const sorted = sortLive(rows)
  await update($, live, () => sorted)

  return sorted
}

// A session's cache lifetime is read from its transcript once; one too long
// to read takes the lifetime last seen anywhere, which is the account's.
let defaultTtl = CACHE_5M
const ttlByPath = new Map<string, number>()
async function ttlFor($: EngineInterface, path: string, size: number): Promise<number> {
  const known = ttlByPath.get(path)
  if (known !== undefined) return known
  if (size > 8 * 1024 * 1024) return defaultTtl
  try {
    const ttl = cacheTtlOf(await $.fs.read(path))
    if (ttl === undefined) return defaultTtl
    defaultTtl = ttl
    ttlByPath.set(path, ttl)

    return ttl
  } catch {
    return defaultTtl
  }
}

type TitleCache = Record<string, { mtimeMs: number; title: string; project: string; cacheTtlMs?: number }>

async function refreshPast($: EngineInterface) {
  const root = `${await homeDir($)}/.claude/projects`
  const liveIds = new Set((await read($, live)).map(s => s.sessionId))
  let dirs
  try {
    dirs = await $.fs.list(root)
  } catch {
    return
  }
  const found: (Omit<PastSession, 'title' | 'project'> & { dir: string })[] = []
  for (const dir of dirs) {
    if (dir.kind !== 'dir') continue
    let files
    try {
      files = await $.fs.list(`${root}/${dir.name}`)
    } catch {
      continue
    }
    for (const file of files) {
      if (file.kind !== 'file' || !file.name.endsWith('.jsonl')) continue
      const sessionId = file.name.slice(0, -'.jsonl'.length)
      found.push({
        path: `${root}/${dir.name}/${file.name}`,
        dir: dir.name,
        sessionId,
        mtimeMs: file.mtimeMs,
        size: file.size,
        isLive: liveIds.has(sessionId),
      })
    }
  }
  found.sort((a, b) => b.mtimeMs - a.mtimeMs)

  const cache = await stored<TitleCache>($, STORE.titles, {})
  let isDirty = false
  const rows: PastSession[] = []
  for (const { dir, ...item } of found) {
    let known = cache[item.path]
    if (!known || known.mtimeMs !== item.mtimeMs) {
      let described = { title: 'Long session', project: '' }
      let cacheTtlMs: number | undefined
      if (item.size <= 4 * 1024 * 1024) {
        try {
          const text = await $.fs.read(item.path)
          described = describeTranscript(text)
          cacheTtlMs = cacheTtlOf(text)
        } catch {
          described = { title: 'Untitled session', project: '' }
        }
      }
      known = { mtimeMs: item.mtimeMs, title: described.title, project: described.project || projectFromDir(dir), cacheTtlMs }
      cache[item.path] = known
      isDirty = true
    }
    if (known.cacheTtlMs !== undefined) {
      // The newest transcript with a reading speaks for the account.
      if (!rows.some(r => r.cacheTtlMs !== undefined)) defaultTtl = known.cacheTtlMs
      ttlByPath.set(item.path, known.cacheTtlMs)
    }
    rows.push({ ...item, title: known.title, project: known.project, cacheTtlMs: known.cacheTtlMs })
  }
  if (isDirty) {
    const keep = new Set(found.map(f => f.path))
    for (const key of Object.keys(cache)) if (!keep.has(key)) delete cache[key]
    await $.store.set(STORE.titles, cache)
  }
  await update($, past, () => rows)
}

// ── Trash ──────────────────────────────────────────────────────────────────

async function trashRoot($: EngineInterface): Promise<string> {
  return `${await homeDir($)}/.claude/command-center-trash`
}

// Moves a transcript (and its folder of subagent transcripts, when it has
// one) into the trash. The trash path stays short (date and session id
// only): project folder names run long, and Windows refuses paths past 260
// characters. Where it came from is kept on the item, so it can go back.
// A trash entry, or why the session could not be moved.
async function moveToTrash($: EngineInterface, session: PastSession, now: number): Promise<TrashItem | string> {
  if (session.isLive) return 'it is still running'
  const day = new Date(now).toISOString().slice(0, 10)
  const toDir = `${await trashRoot($)}/${day}`
  const moved = await runScript($, moveScript(session.path, toDir))
  if (!moved.ok) return moveFailure(moved.error)
  // Trust the disk, not the exit code: the file must really have left.
  if (await $.fs.exists(session.path)) return 'its file is still there after the move'
  const sideDir = `${parentOf(session.path)}/${session.sessionId}`
  if (await $.fs.exists(sideDir)) await runScript($, moveScript(sideDir, toDir))

  return {
    trashedPath: `${toDir}/${basename(session.path)}`,
    originalPath: session.path,
    project: session.project,
    title: session.title,
    size: session.size,
    deletedAt: now,
  }
}

async function saveTrash($: EngineInterface, fn: (list: TrashItem[]) => TrashItem[]) {
  const list = await update($, trash, fn)
  await $.store.set(STORE.trash, list)
}

async function deleteSession($: EngineInterface, path: string) {
  await setView($, { confirm: undefined })
  const found = (await read($, past)).find(s => s.path === path)
  if (!found) return
  // Ask the machine again: a session may have started since the list was read.
  const liveNow = new Set((await refreshLive($)).map(s => s.sessionId))
  const target = { ...found, isLive: liveNow.has(found.sessionId) }
  const item = await moveToTrash($, target, await $.clock.now())
  if (typeof item === 'string') {
    $.ui.toast(`Couldn't move "${target.title.slice(0, 40)}" to trash: ${item}.`, { timeoutMs: 6000 })
    await refreshPast($)

    return
  }
  // Gone from the list at once, before the folders are read again.
  await update($, past, l => l.filter(s => s.path !== path))
  await saveTrash($, l => [item, ...l])
  $.ui.toast('Moved to trash. Restore it from the Trash tab.', { timeoutMs: 3000 })
  await refreshPast($)
}

async function cleanupOld($: EngineInterface, days: number) {
  await setView($, { confirm: undefined })
  const now = await $.clock.now()
  const moved: TrashItem[] = []
  for (const session of olderThan(await read($, past), days, now)) {
    const item = await moveToTrash($, session, now)
    if (typeof item !== 'string') moved.push(item)
  }
  await saveTrash($, l => [...moved, ...l])
  await refreshPast($)
  $.ui.toast(`Moved ${moved.length} old session${moved.length === 1 ? '' : 's'} to trash.`)
}

async function restoreFromTrash($: EngineInterface, trashedPath: string) {
  const item = (await read($, trash)).find(t => t.trashedPath === trashedPath)
  if (!item) return
  const home = parentOf(item.originalPath)
  const back = await runScript($, moveScript(item.trashedPath, home))
  if (!back.ok) {
    $.ui.toast(`Couldn't restore that session: ${moveFailure(back.error)}.`, { timeoutMs: 6000 })

    return
  }
  const sideDir = `${parentOf(item.trashedPath)}/${basename(item.trashedPath).replace(/\.jsonl$/, '')}`
  if (await $.fs.exists(sideDir)) await runScript($, moveScript(sideDir, home))
  await saveTrash($, l => l.filter(t => t.trashedPath !== trashedPath))
  await refreshPast($)
}

// The one permanent step, behind its own confirm in the Sessions card.
async function emptyTrash($: EngineInterface) {
  await setView($, { confirm: undefined })
  const root = await trashRoot($)
  if ((await $.fs.exists(root)) && !(await runScript($, removeScript(root))).ok) {
    $.ui.toast("Couldn't empty the trash.")

    return
  }
  await saveTrash($, () => [])
}

// ── Notes, actions, view ───────────────────────────────────────────────────

async function setView($: EngineInterface, patch: Partial<View>) {
  const next = await update($, view, v => ({ ...v, ...patch }))
  // The confirm prompt and the page are per moment, never remembered.
  await $.store.set(STORE.view, { ...next, confirm: undefined, pastPage: 0, openActivity: undefined, flowOffset: 0 })
}

async function notesFile($: EngineInterface): Promise<string> {
  return `${await homeDir($)}/.claude/command-center-notes.md`
}

// The notes place on disk: every saved note, newest first, as Markdown.
async function writeNotesFile($: EngineInterface, list: Note[]) {
  const lines = list.map(n => `- **${new Date(n.at).toISOString().slice(0, 16).replace('T', ' ')}** ${n.text.replace(/\n/g, ' ')}`)
  try {
    await $.fs.write(await notesFile($), `# Command center notes\n\n${lines.join('\n')}\n`)
  } catch {
    // The list in the pane still holds them.
  }
}

async function addNote($: EngineInterface, text: string, isToasted = true) {
  const clean = text.trim()
  if (!clean) return
  const now = await $.clock.now()
  const list = await update($, notes, l => [{ id: `${now}`, text: clean, at: now }, ...l].slice(0, 200))
  await $.store.set(STORE.notes, list)
  await writeNotesFile($, list)
  if (isToasted) $.ui.toast(`Note saved · ${list.length} in your notes`, { timeoutMs: 2500 })
}

async function openNotes($: EngineInterface) {
  const path = await notesFile($)
  if (!(await $.fs.exists(path))) await writeNotesFile($, await read($, notes))
  try {
    if (await isWindows($)) await $.process.run(['explorer', path.replace(/\//g, '\\')], { timeoutMs: 10_000 })
    else await $.process.run(['sh', '-c', 'open "$1" 2>/dev/null || xdg-open "$1"', 'sh', path], { timeoutMs: 10_000 })
  } catch {
    $.ui.toast(`Notes are in ${path}`)
  }
}

async function setGlance($: EngineInterface, isOn: boolean) {
  await setView($, { glance: isOn })
  if (!isOn) $.ui.toast('Glance hidden. /cc-glance on brings it back.', { timeoutMs: 4000 })
}

async function removeNote($: EngineInterface, id: string) {
  const list = await update($, notes, l => l.filter(n => n.id !== id))
  await $.store.set(STORE.notes, list)
  await writeNotesFile($, list)
}

async function submit($: EngineInterface, text: string) {
  if (text.trim() === '/compact') {
    await $.command.run({ command: 'compact', args: '' })

    return
  }
  await $.prompt.submit({ text, asUser: true })
}

async function setActions($: EngineInterface, fn: (list: CustomAction[]) => CustomAction[]) {
  const list = await update($, actions, fn)
  await $.store.set(STORE.actions, list)
}

// ── Agents ─────────────────────────────────────────────────────────────────

async function refreshAgents($: EngineInterface) {
  let list
  try {
    list = await $.agent.list()
  } catch {
    return
  }
  const now = await $.clock.now()
  await update($, agents, prev => {
    const known = new Map(prev.map(a => [a.id, a]))
    const seen = new Set<string>()
    const rows: AgentRow[] = list.map(info => {
      seen.add(info.id)
      const old = known.get(info.id)
      const isOver = ['completed', 'failed', 'killed', 'idle'].includes(info.status)

      return {
        id: info.id,
        description: info.description,
        type: info.type,
        status: info.status,
        firstSeenAt: old?.firstSeenAt ?? now,
        endedAt: isOver ? (old?.endedAt ?? now) : undefined,
      }
    })
    // The engine drops finished agents after a while; keep a short memory.
    const gone = prev
      .filter(a => !seen.has(a.id))
      .map(a => ({ ...a, status: a.endedAt === undefined ? 'completed' : a.status, endedAt: a.endedAt ?? now }))

    return [...rows, ...gone].slice(0, 20)
  })
}

async function spawnHelper($: EngineInterface, helper: string, task: string) {
  const clean = task.trim()
  if (!clean) return
  const key = helper in HELPERS ? helper : 'scout'
  const spec = HELPERS[key] as Helper
  const result = await $.agent.spawn({
    prompt: clean,
    description: `${spec.label}: ${clean.slice(0, 48)}`,
    subagentType: `command-center:${key}`,
    model: spec.model,
  })
  if ('deny' in result && result.deny) $.ui.toast(`Couldn't start ${spec.label}: ${result.deny}`)
  await refreshAgents($)
}

// ── Status line and alerts ─────────────────────────────────────────────────

async function refreshStatus($: EngineInterface) {
  const m = await read($, measure)
  const running = (await read($, agents)).filter(a => a.endedAt === undefined).length
  const parts: string[] = []
  if (m.context !== undefined) parts.push(`ctx ${Math.round(m.context)}%`)
  const fiveHour = m.limits.find(l => /five|5h/i.test(l.kind))
  if (fiveHour) {
    const at = fiveHour.resetsAt ? Date.parse(fiveHour.resetsAt) : NaN
    parts.push(`5h ${Math.round(fiveHour.percent)}%${Number.isFinite(at) ? ` resets ${fmtTimeOfDay(at)}` : ''}`)
  }
  const week = m.limits.find(l => /seven|week|7d/i.test(l.kind))
  if (week) parts.push(`7d ${Math.round(week.percent)}%`)
  const here = (await read($, live)).find(s => s.isHere)
  if (here?.isBusy) parts.push('cache warm')
  else if (here?.lastAt !== undefined) {
    const left = cacheLeft(here.lastAt, await $.clock.now(), here.cacheTtlMs ?? defaultTtl)
    parts.push(left > 0 ? `cache warm ${fmtDuration(left)}` : 'cache cold')
  }
  if (running > 0) parts.push(`${running} agent${running === 1 ? '' : 's'}`)
  const list = await read($, todos)
  const est = eta(list, await $.clock.now(), await stored<number | undefined>($, STORE.taskMedianMs, undefined))
  if (est.leftMs !== undefined && est.done < est.total) parts.push(`~${fmtDuration(est.leftMs)} left`)
  $.ui.status(parts.length > 0 ? parts.join(' | ') : 'command center | /cc')
}

// Asks for the usage figures directly: a fresh or reloaded session has had
// no measurement yet, which would leave the gauges and status line blank.
// The engine's rate-limit readings as the command center keeps them.
async function takeLimits($: EngineInterface, raw: readonly { kind: string; percentUsed: number; resetsAt?: unknown }[]) {
  const limits = raw.map(r => ({ kind: r.kind, percent: r.percentUsed, resetsAt: toResetIso(r.resetsAt) }))
  if (raw.length > 0) void $.store.set(STORE.limitsSeen, raw.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt ?? null })))
  const now = await $.clock.now()

  return (prev: Limit[]) => mergeLimits(prev, limits, now)
}

async function readUsage($: EngineInterface) {
  try {
    const usage = await $.session.usage()
    const merge = await takeLimits($, usage.rateLimits)
    await update($, measure, prev => ({ context: usage.context.percent ?? prev.context, limits: merge(prev.limits) }))
  } catch {
    // Figures arrive with the next measurement instead.
  }
  await refreshStatus($)
}

// Everything read again at once: sessions here and elsewhere, helpers,
// limits, and the mission, even inside its usual 45-second pause.
async function refreshAll($: EngineInterface) {
  $.ui.toast('Refreshing…', { timeoutMs: 1500 })
  // One part failing never stops the others.
  const results = await Promise.allSettled([
    refreshLive($).then(() => refreshPast($)),
    refreshAgents($),
    readUsage($),
    deriveMission($, true),
  ])
  await update($, tick, n => n + 1)
  await refreshStatus($).catch(() => undefined)
  const failed = results.filter(r => r.status === 'rejected').length
  $.ui.toast(failed === 0 ? 'Everything is up to date.' : `Refreshed, but ${failed} part${failed === 1 ? '' : 's'} could not be read.`, { timeoutMs: 2500 })
}

// Each threshold speaks once as it is crossed, and again only after the
// value has fallen back below it.
const alerted = new Set<string>()
function crossing($: EngineInterface, key: string, value: number, threshold: number, text: string) {
  if (value >= threshold && !alerted.has(key)) {
    alerted.add(key)
    $.ui.toast(text, { timeoutMs: 6000 })
  } else if (value < threshold - 5) {
    alerted.delete(key)
  }
}

// ── The pane ───────────────────────────────────────────────────────────────

function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: TITLE, columns: 150 })
}

function actsFor($: EngineInterface): Act {
  return {
    setView: patch => void setView($, patch),
    askConfirm: key => void setView($, { confirm: key }),
    cancelConfirm: () => void setView($, { confirm: undefined }),
    setDraft: text => {
      typed = text
    },
    saveNote: text => {
      if (!text.trim()) return
      typed = ''
      void addNote($, text).then(() => update($, draftGen, n => n + 1))
    },
    sendNote: text => {
      if (!text.trim()) return
      void submit($, text)
    },
    sendDraft: () => {
      const text = typed.trim()
      if (!text) {
        $.ui.toast('Type a note first.', { timeoutMs: 2500 })
        return
      }
      typed = ''
      void addNote($, text, false)
        .then(() => submit($, text))
        .then(() => update($, draftGen, n => n + 1))
    },
    openNotes: () => void openNotes($),
    setGlance: isOn => void setGlance($, isOn),
    openFull: () => void openPane($),
    copy: text => {
      void $.ui.copy({ text }).then(r => $.ui.toast(r.isCopied ? 'Copied.' : "Couldn't copy here.", { timeoutMs: 2500 }))
    },
    pinMission: text => void update($, goal, () => text.trim()),
    unpinMission: () => void update($, goal, () => '').then(() => deriveMission($)),
    removeNote: id => void removeNote($, id),
    submit: text => void submit($, text),
    spawn: (helper, task) => void spawnHelper($, helper, task),
    refreshPast: () => void refreshPast($),
    refreshAll: () => void refreshAll($),
    aboutLimit: text => {
      $.ui.toast(text, { timeoutMs: 5000 })
      void readUsage($)
    },
    deleteSession: path => void deleteSession($, path),
    cleanupOld: days => void cleanupOld($, days),
    restore: path => void restoreFromTrash($, path),
    emptyTrash: () => void emptyTrash($),
    clearSession: async () => {
      await setView($, { confirm: undefined })
      await $.command.run({ command: 'clear', args: '' })
    },
  }
}

// Every read here subscribes the pane, so a write anywhere redraws it.
async function loadData($: EngineInterface): Promise<Data> {
  await read($, tick)

  return {
    goal: await read($, goal),
    auto: await read($, auto),
    todos: await read($, todos),
    feed: await read($, feed),
    counts: await read($, counts),
    measure: await read($, measure),
    agents: await read($, agents),
    live: await read($, live),
    past: await read($, past),
    trash: await read($, trash),
    notes: await read($, notes),
    draftGen: await read($, draftGen),
    actions: await read($, actions),
    view: await read($, view),
    turnStartedAt: await read($, turnStartedAt),
    now: await $.clock.now(),
    storedMedianMs: await stored<number | undefined>($, STORE.taskMedianMs, undefined),
  }
}

// ── Tool calls ─────────────────────────────────────────────────────────────

function kindOf(tool: string): ToolKind | undefined {
  if (tool === 'TodoWrite') return undefined
  if (['Edit', 'Write', 'NotebookEdit', 'MultiEdit'].includes(tool)) return 'edit'
  if (['Bash', 'PowerShell'].includes(tool)) return 'run'
  if (['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'LS'].includes(tool)) return 'read'
  if (['Agent', 'Task'].includes(tool)) return 'agent'

  return 'tool'
}

const lineCount = (text: string) => (text ? text.split('\n').length : 0)
const quote = (text: string, max = 48) => `“${text.length > max ? `${text.slice(0, max - 1)}…` : text}”`
const folderOf = (path: string) => {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)

  return parts.length > 1 ? parts[parts.length - 2] : undefined
}

// Each call as a plain sentence: what was done (verb), to what (label), and
// a quiet detail that says how (the command, the lines, where it looked).
function describeCall(tool: string, input: Record<string, unknown>): { verb: string; label: string; detail?: string } {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const n = (k: string) => (typeof input[k] === 'number' ? (input[k] as number) : undefined)
  const file = s('file_path') || s('notebook_path')
  const where = file ? folderOf(file) : undefined

  switch (tool) {
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit': {
      const removed = lineCount(s('old_string'))
      const added = lineCount(s('new_string'))
      const change = added || removed ? `+${added} −${removed} lines` : undefined

      return { verb: 'Edited', label: basename(file), detail: [change, where && `in ${where}`].filter(Boolean).join(' · ') || undefined }
    }
    case 'Write':
      return { verb: 'Wrote', label: basename(file), detail: [`${lineCount(s('content'))} lines`, where && `in ${where}`].filter(Boolean).join(' · ') }
    case 'Read': {
      const from = n('offset')
      const limit = n('limit')
      const range = from !== undefined || limit !== undefined ? `lines ${from ?? 1}–${(from ?? 1) + (limit ?? 2000)}` : undefined

      return { verb: 'Read', label: basename(file), detail: [range, where && `in ${where}`].filter(Boolean).join(' · ') || undefined }
    }
    case 'Bash':
    case 'PowerShell': {
      const command = (s('command').split('\n')[0] ?? '').trim()
      // The description Claude gives a command is the clearest sentence there is.
      // The whole command, every line of it, for the details and for copying.
      const full = s('command').trim()
      if (s('description')) return { verb: s('description'), label: '', detail: full.length > 600 ? `${full.slice(0, 599)}…` : full }

      return { verb: 'Ran', label: command.slice(0, 80) }
    }
    case 'Grep':
      return { verb: 'Searched for', label: quote(s('pattern')), detail: [s('path') ? `in ${basename(s('path'))}` : 'in the project', s('glob') && `(${s('glob')})`].filter(Boolean).join(' ') }
    case 'Glob':
      return { verb: 'Looked for files', label: quote(s('pattern')), detail: s('path') ? `in ${basename(s('path'))}` : undefined }
    case 'WebFetch': {
      const url = s('url').replace(/^https?:\/\//, '')

      return { verb: 'Opened', label: url.split('/')[0] ?? url, detail: url.slice(url.indexOf('/') + 1, 80) || undefined }
    }
    case 'WebSearch':
      return { verb: 'Searched the web for', label: quote(s('query')) }
    case 'Agent':
    case 'Task':
      return { verb: `Asked ${s('subagent_type') || 'an agent'}`, label: s('description') || 'to help', detail: s('model') || undefined }
    case 'Skill':
      return { verb: 'Used skill', label: s('skill') || s('command') }
    case 'ToolSearch':
      return { verb: 'Loaded tools', label: quote(s('query')) }
    case 'AskUserQuestion':
      return { verb: 'Asked you', label: 'a question' }
    default: {
      const mcp = tool.match(/^mcp__(.+?)__(.+)$/)
      if (!mcp) return { verb: 'Used', label: tool }
      const server = /^[0-9a-f-]{20,}$/.test(mcp[1] ?? '') ? undefined : (mcp[1] ?? '').replace(/[-_]/g, ' ')

      return { verb: 'Used', label: (mcp[2] ?? '').replace(/_/g, ' '), detail: server ? `from ${server}` : 'from a connector' }
    }
  }
}

// ── Mission, as the conversation suggests it ───────────────────────────────

const stripTags = (t: string) => t.replace(/<([a-z][\w-]*)[^>]*>[\s\S]*?<\/\1>/gi, '').trim()

let isDeriving = false

// The sentence Claude says before a batch of tool calls names what they are
// for. It holds for the calls that follow until their results come back.
let narration: string | undefined

// After a turn, a small model reads the recent asks and names the mission
// and the steps toward it. Runs only when something new was asked, at most
// every 45s, and never while the mission is pinned.
async function deriveMission($: EngineInterface, isForced = false) {
  if (isDeriving || (await read($, goal))) return
  const msgs = await $.session.messages()
  const asks = msgs
    .filter(m => m.role === 'user')
    .map(m => stripTags(m.text))
    .filter(t => t && !t.startsWith('<') && !t.startsWith('/'))
  if (asks.length === 0) return
  const prev = await read($, auto)
  const now = await $.clock.now()
  if (!isForced && prev.mission && (asks.length === prev.prompts || now - prev.at < 45_000)) return
  isDeriving = true
  try {
    const lastAnswer = [...msgs].reverse().find(m => m.role === 'assistant' && m.text.trim())?.text ?? ''
    const res = await $.model.complete({
      model: 'haiku',
      system: MISSION_SYSTEM,
      prompt: missionPrompt(asks, lastAnswer),
      maxTokens: 400,
      timeoutMs: 30_000,
    })
    if (!res.isAnswered) return
    const parsed = parseMission(res.text)
    if (parsed) await update($, auto, () => ({ ...parsed, at: now, prompts: asks.length }))
  } catch {
    // A refused or unreachable model leaves the last mission in place.
  } finally {
    isDeriving = false
  }
}

// ── Registration ───────────────────────────────────────────────────────────

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const savedNotes = await stored<Note[]>($, STORE.notes, [])
    const savedActions = await stored<CustomAction[]>($, STORE.actions, [])
    const savedView = await stored<Partial<View>>($, STORE.view, {})
    const savedTrash = await stored<TrashItem[]>($, STORE.trash, [])
    await update($, notes, () => savedNotes)
    await update($, actions, () => savedActions)
    const layout: Layout = LAYOUT_IDS.includes(savedView.layout as Layout) ? (savedView.layout as Layout) : DEFAULT_VIEW.layout
    await update($, view, () => ({ ...DEFAULT_VIEW, ...savedView, layout, confirm: undefined, pastPage: 0, openActivity: undefined, flowOffset: 0 }))
    // Only what is really in the trash: an entry whose file is gone (emptied
    // by hand, or a move that never landed) is dropped.
    const inTrash: TrashItem[] = []
    for (const t of savedTrash) if (await $.fs.exists(t.trashedPath)) inTrash.push(t)
    await update($, trash, () => inTrash)
    if (inTrash.length !== savedTrash.length) await $.store.set(STORE.trash, inTrash)

    await $.command.register({ name: 'cc', description: 'Open the command center' })
    await $.command.register({ name: 'cc-layout', description: 'Switch the command center layout', argumentHint: 'rows | columns | strip | focus' })
    await $.command.register({ name: 'cc-glance', description: 'Show or hide the glance above the prompt', argumentHint: 'on | off' })
    await $.command.register({ name: 'mission', description: 'Pin your mission to the command center (empty clears it)', argumentHint: '<what you are working toward>' })
    await $.command.register({ name: 'note', description: 'Save a note to the command center', argumentHint: '<text>' })
    await $.command.register({ name: 'spawn', description: 'Hand a small job to a helper agent', argumentHint: 'scout | tester | scribe <task>' })
    await $.command.register({
      name: 'cc-action',
      description: 'Add, remove or list your own quick actions',
      argumentHint: 'add <label> | <prompt>  ·  remove <label>  ·  list',
    })
    for (const [name, h] of Object.entries(HELPERS)) {
      try {
        await $.agent.register({ name, description: h.description, prompt: h.prompt, tools: h.tools, model: h.model })
      } catch {
        // A helper the engine refuses is simply not offered.
      }
    }

    // Time labels move every 30s at most; nothing on the pane ticks faster.
    $.clock.every(30_000, () => {
      void update($, tick, n => n + 1)
      void readUsage($)
    })
    $.clock.every(10_000, () => void refreshLive($))
    $.clock.every(5_000, () => void refreshAgents($).then(() => refreshStatus($)))
    void refreshLive($).then(() => refreshPast($))
    void deriveMission($)
    // The status line and gauges fill at once, not only after the next reply.
    void readUsage($)

    // The glance sits above the prompt; on the desktop the full command
    // center opens beside the transcript as well, as it always has.
    if (e.surface === 'desktop' || e.surface === 'vscode') void openPane($)

    return next(e)
  })

  // Watches the rows of the main conversation for Claude's own words; never
  // changes them.
  on('session.append', ($, e, next) => {
    if (e.agentId === undefined) {
      if (e.door === 'response' && e.message.role === 'assistant') {
        const text = e.message.content
          .map(b => ((b as { type?: string }).type === 'text' ? String((b as { text?: unknown }).text ?? '') : ''))
          .join(' ')
          .trim()
        if (text) narration = purposeFrom(text)
      } else if (e.door === 'tool-result' || e.door === 'prompt') {
        narration = undefined
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const tool = String(e.tool)
    const input = e as unknown as Record<string, unknown>
    const now = await $.clock.now()

    if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
      const merged = await update($, todos, prev => mergeTodos(prev, input.todos as Parameters<typeof mergeTodos>[1], now))
      const before = await stored<number | undefined>($, STORE.taskMedianMs, undefined)
      const blended = blendMedian(before, merged)
      if (blended !== undefined && blended !== before) await $.store.set(STORE.taskMedianMs, blended)
      void refreshStatus($)

      return next(e)
    }

    const kind = kindOf(tool)
    if (!kind) return next(e)
    const item: FeedItem = { id: e.tool_use_id, kind, ...describeCall(tool, input), why: narration, startedAt: now }
    await update($, feed, list => [...list, item].slice(-200))

    const ran = await next(e)

    const isError = ran.deny !== undefined || ran.isError === true
    const endedAt = await $.clock.now()
    // A short look at what came back, for the row's details.
    const said = typeof ran.text === 'string' ? ran.text : ran.deny ?? ''
    const out = said.replace(/\r/g, '').trim().split('\n').slice(0, 6).join('\n').slice(0, 500) || undefined
    await update($, feed, list => list.map(f => (f.id === item.id ? { ...f, endedAt, isError, out } : f)))
    await update($, counts, c => ({
      edits: c.edits + (kind === 'edit' && !isError ? 1 : 0),
      runs: c.runs + (kind === 'run' ? 1 : 0),
      errors: c.errors + (isError ? 1 : 0),
    }))
    if (kind === 'agent') void refreshAgents($)

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    await update($, turnStartedAt, () => Date.now())

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, turnStartedAt, () => 0)
      if (!e.isAborted && e.durationMs > 60_000) void $.ui.notify(`Done in ${fmtDuration(e.durationMs)}`, { title: 'Claude' })
      if (!e.isAborted) void deriveMission($)
    }
    void refreshAgents($)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const merge = await takeLimits($, e.rateLimits)
    await update($, measure, prev => ({ context: e.context.percent ?? prev.context, limits: merge(prev.limits) }))
    if (e.context.percent !== undefined) {
      crossing($, 'context', e.context.percent, 80, `Context is ${Math.round(e.context.percent)}% full. A /compact soon keeps things sharp.`)
    }
    for (const r of e.rateLimits) crossing($, `limit:${r.kind}`, r.percentUsed, 90, `${r.kind} usage is at ${Math.round(r.percentUsed)}%.`)
    void refreshStatus($)

    return next(e)
  })

  on('command.run', { command: 'cc' }, async $ => {
    void refreshLive($).then(() => refreshPast($))
    const opened = await openPane($)

    return { text: opened.isPlaced ? 'Command center opened.' : `Command center is ready, but this surface can't show it here (${opened.reason}).` }
  })

  on('command.run', { command: 'cc-layout' }, async ($, e) => {
    const id = e.args.trim().toLowerCase() as Layout
    if (!LAYOUT_IDS.includes(id)) return { text: `Layouts: ${LAYOUT_IDS.join(', ')}.` }
    await setView($, { layout: id })
    void openPane($)

    return { text: `Layout set to ${id}.` }
  })

  on('command.run', { command: 'cc-glance' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const isOn = arg === '' ? !(await read($, view)).glance : arg === 'on'
    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: 'Usage: /cc-glance on | off' }
    await setView($, { glance: isOn })

    return { text: isOn ? 'Glance is on above the prompt.' : 'Glance is off.' }
  })

  on('command.run', { command: 'mission' }, async ($, e) => {
    const text = e.args.trim()
    await update($, goal, () => text)

    return { text: text ? `Mission pinned: ${text}` : 'Mission cleared.' }
  })

  on('command.run', { command: 'note' }, async ($, e) => {
    if (!e.args.trim()) return { text: 'Usage: /note <text>' }
    await addNote($, e.args)

    return { text: 'Noted.' }
  })

  on('command.run', { command: 'spawn' }, async ($, e) => {
    const [first = '', ...rest] = e.args.trim().split(/\s+/)
    const named = first.toLowerCase() in HELPERS ? first.toLowerCase() : undefined
    const task = (named ? rest.join(' ') : e.args).trim()
    if (!task) return { text: `Usage: /spawn ${Object.keys(HELPERS).join(' | ')} <task>` }
    await spawnHelper($, named ?? 'scout', task)

    return { text: `${HELPERS[named ?? 'scout']?.label ?? 'Helper'} is on it.` }
  })

  on('command.run', { command: 'cc-action' }, async ($, e) => {
    const args = e.args.trim()
    if (args.startsWith('add ')) {
      const [label = '', ...prompt] = args.slice(4).split('|')
      const body = prompt.join('|').trim()
      if (!label.trim() || !body) return { text: 'Usage: /cc-action add <label> | <prompt>' }
      if (BUILT_IN_ACTIONS.some(a => a.label.toLowerCase() === label.trim().toLowerCase())) return { text: `“${label.trim()}” is a built-in action.` }
      await setActions($, l => [...l.filter(a => a.label !== label.trim()), { label: label.trim(), prompt: body }].slice(0, 8))

      return { text: `Added “${label.trim()}”.` }
    }
    if (args.startsWith('remove ')) {
      await setActions($, l => l.filter(a => a.label !== args.slice(7).trim()))

      return { text: 'Removed.' }
    }
    const list = await read($, actions)

    return { text: list.length > 0 ? list.map(a => `• ${a.label}: ${a.prompt}`).join('\n') : 'No custom actions yet. Add one with /cc-action add <label> | <prompt>' }
  })

  // Above the prompt: one calm line of only what matters right now.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, view)).glance) return next(e)
    const kit = makeKit(actsFor($), e.surface, $.ui.resolve(e))

    return Glance(kit, await loadData($), e.props.bodyColumns)
  })

  on('ui.render', { component: 'Pane', requestId: 'command-center' }, async ($, e) => {
    const kit = makeKit(actsFor($), e.surface, $.ui.resolve(e))

    return Pane(kit, await loadData($), e.props.bodyColumns)
  })
}
