import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Session } from '../types'

const PANE = 'sessions'
const DAY = 86_400_000
const UUID = /^[0-9a-f-]{36}$/

const sessions = atom({ plugin: 'sessions', key: 'sessions' } as const, [] as Session[], { shape: 'sessions-1' })
const filter = atom({ plugin: 'sessions', key: 'filter' } as const, '')
const hits = atom({ plugin: 'sessions', key: 'hits' } as const, null as string[] | null)
const selected = atom({ plugin: 'sessions', key: 'selected' } as const, null as string | null)
const confirm = atom({ plugin: 'sessions', key: 'confirm' } as const, null as string | null)
const message = atom({ plugin: 'sessions', key: 'message' } as const, '')

// Per transcript: id|time|bytes|cwd|title. -List stops at the first cwd; the title scan reads the
// whole file, preferring a /rename title over Claude's auto title.
const LIST = `Get-ChildItem "$env:USERPROFILE\\.claude\\projects\\*\\*.jsonl" | % {
  $c = Select-String -LiteralPath $_.FullName -Pattern '"cwd":"([^"]*)"' -List
  if ($c) {
    $t = Select-String -LiteralPath $_.FullName -Pattern '"(customTitle|aiTitle)":"((?:[^"\\\\]|\\\\.)*)"'
    $pick = $t | ? { $_.Matches[0].Groups[1].Value -eq 'customTitle' } | Select-Object -Last 1
    if (-not $pick) { $pick = $t | Select-Object -Last 1 }
    $title = if ($pick) { $pick.Matches[0].Groups[2].Value } else { '' }
    $_.BaseName + '|' + $_.LastWriteTime.ToString('o') + '|' + $_.Length + '|' + $c.Matches[0].Groups[1].Value + '|' + $title
  }
}`

const RECYCLE = `Add-Type -AssemblyName Microsoft.VisualBasic
foreach ($id in $env:SESSION_IDS -split ',') {
  foreach ($p in Get-Item "$env:USERPROFILE\\.claude\\projects\\*\\$id.jsonl", "$env:USERPROFILE\\.claude\\projects\\*\\$id" -ErrorAction SilentlyContinue) {
    if ($p.PSIsContainer) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p.FullName, 'OnlyErrorDialogs', 'SendToRecycleBin') }
    else { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p.FullName, 'OnlyErrorDialogs', 'SendToRecycleBin') }
  }
}`

const SEARCH = `Select-String -Path "$env:USERPROFILE\\.claude\\projects\\*\\*.jsonl" -SimpleMatch -Pattern $env:QUERY -List |
  % { [IO.Path]::GetFileNameWithoutExtension($_.Path) }`

// Values are JSON-escaped in the transcript, so each field is unescaped as a JSON string.
export const parseSessions = (stdout: string): Session[] =>
  stdout.split(/\r?\n/).filter(Boolean).map(line => {
    const [id = '', time = '', bytes = '', cwd = '', ...rest] = line.split('|')
    return {
      id,
      time: new Date(time).getTime(),
      bytes: Number(bytes),
      cwd: JSON.parse(`"${cwd}"`),
      title: JSON.parse(`"${rest.join('|')}"`) || '(untitled)',
    }
  }).sort((a, b) => b.time - a.time)

const ps = ($: EngineInterface, script: string, env?: Record<string, string>) =>
  $.process.run(['powershell', '-NoProfile', '-Command', script], { env, timeoutMs: 60_000 })
    .catch((err: Error) => ({ exitCode: 1, stdout: '', stderr: err.message }))

const load = async ($: EngineInterface) => {
  const { exitCode, stdout, stderr } = await ps($, LIST)
  if (exitCode !== 0) return update($, message, () => `Could not list sessions: ${stderr}`)
  const list = parseSessions(stdout)
  await update($, sessions, () => list)
  return list
}

const resumeCmd = (s: Session) => `cd "${s.cwd}"; claude --resume ${s.id}`

const openTab = async ($: EngineInterface, s: Session) => {
  // The engine refuses wt.exe's WindowsApps alias, so PowerShell launches it; -w 0 = a tab in this window.
  const tab = await ps($, '& wt.exe -w 0 nt -d $env:RESUME_CWD claude --resume $env:RESUME_ID',
    { RESUME_CWD: s.cwd, RESUME_ID: s.id })
  return tab.exitCode === 0
    ? `Opened "${s.title}" in a new tab.`
    : `Could not open a tab: ${tab.stderr}\nRun: ${resumeCmd(s)}`
}

// Sends transcripts and their <id>/ folders to the Recycle Bin and drops their prompt-history lines.
const recycle = async ($: EngineInterface, ids: string[]) => {
  const me = await $.session.id()
  const doomed = ids.filter(id => id !== me && UUID.test(id))
  if (doomed.length === 0) return 'Nothing to delete (the current session is never deleted).'
  const { exitCode, stderr } = await ps($, RECYCLE, { SESSION_IDS: doomed.join(',') })
  if (exitCode !== 0) return `Delete failed: ${stderr}`

  const home = (await $.env.get('USERPROFILE')) ?? ''
  const path = `${home}\\.claude\\history.jsonl`
  const history = await $.fs.read(path).catch(() => '')
  if (history) {
    const kept = history.split('\n').filter(line => !doomed.some(id => line.includes(`"sessionId":"${id}"`)))
    await $.fs.write(path, kept.join('\n'))
  }
  await load($)
  return `Moved ${doomed.length} session${doomed.length === 1 ? '' : 's'} to the Recycle Bin.`
}

// Academic palette: navy frames, claret for danger, old gold for the focus, sage for fresh.
const C = { navy: '#4A6FA5', claret: '#A23B57', gold: '#C5A253', sage: '#87A96B', ink: '#8A8577' }

const age = (ms: number) => {
  const m = Math.floor((Date.now() - ms) / 60_000)
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`
}
// Recency as a colored dot: the eye finds "today" without reading ages.
const freshness = (ms: number) => {
  const d = (Date.now() - ms) / DAY
  return d < 1 ? C.sage : d < 7 ? C.gold : C.ink
}
// Size as a one-glyph spark, scaled to the largest transcript.
const spark = (bytes: number, max: number) => '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor((bytes / Math.max(1, max)) * 7.999))]
const folder = (cwd: string) => cwd.split('\\').filter(Boolean).at(-1) ?? cwd
const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`
const fit = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(0, n - 1))}…` : s.padEnd(n))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'sessions',
      description: 'Browse, search, open and delete sessions from every folder',
      argumentHint: '[<id> | prune <days>]',
    })

    return next(e)
  })

  on('command.run', { command: 'sessions' }, async ($, e) => {
    const [first, second] = e.args.trim().split(/\s+/)
    if (first === 'prune') {
      const days = Number(second ?? 30)
      if (!(days > 0)) return { text: 'Usage: /sessions prune <days>' }
      const list = await load($)
      if (!Array.isArray(list)) return { text: 'Could not list sessions.' }
      return { text: await recycle($, list.filter(s => Date.now() - s.time > days * DAY).map(s => s.id)) }
    }
    if (first) {
      const list = await load($)
      const hit = Array.isArray(list) ? list.find(s => s.id.startsWith(first)) : undefined
      return { text: hit ? await openTab($, hit) : `No session starting with ${first}.` }
    }

    await update($, confirm, () => null)
    await update($, message, () => 'Loading…')
    await $.ui.open({ id: PANE, title: 'Sessions', focus: true })
    await load($)
    await update($, message, () => '')
    return { text: 'Sessions pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Input = 'Input' in els ? els.Input : undefined // mobile draws no fields
    const all = await read($, sessions)
    const typed = await read($, filter)
    const text = typed.toLowerCase()
    const found = await read($, hits)
    const armed = await read($, confirm)
    const note = await read($, message)
    const me = await $.session.id()

    const shown = all.filter(s =>
      (!found || found.includes(s.id)) &&
      (!text || found || `${s.title} ${s.cwd} ${s.id}`.toLowerCase().includes(text)))
    const pickedId = await read($, selected)
    const pick = shown.find(s => s.id === pickedId) ?? shown[0]
    const old = all.filter(s => Date.now() - s.time > 30 * DAY && s.id !== me)
    const max = Math.max(...all.map(s => s.bytes), 1)
    const total = all.reduce((n, s) => n + s.bytes, 0)

    const cols = Math.max(40, e.props.bodyColumns ?? 72)
    const rows = e.props.scroll?.bodyRows ?? e.viewport?.rows ?? 24
    // Row "├▶● title  age ▅  size": frame + padding 4, gutter 3, age 6, spark 1, size 8.
    const titleWidth = Math.max(12, cols - 4 - 4 - 6 - 1 - 8)

    // Tree by folder, folders ordered by their newest session (the list is already newest first).
    const groups = new Map<string, Session[]>()
    for (const s of shown) groups.set(s.cwd, [...(groups.get(s.cwd) ?? []), s])
    let budget = Math.max(4, rows - 17)
    const tree: { cwd: string; list: Session[]; hidden: number }[] = []
    for (const [cwd, list] of groups) {
      if (budget < 2) break
      const fits = list.slice(0, budget - 1)
      tree.push({ cwd, list: fits, hidden: list.length - fits.length })
      budget -= fits.length + 1
    }

    const say = (words: string) => update($, message, () => words)
    const act = (name: string, run: () => Promise<unknown>) => async () => {
      if (name !== 'delete' && name !== 'prune') await update($, confirm, () => null)
      await run()
    }
    const isArmed = pick !== undefined && armed === `delete:${pick.id}`
    const isError = note.startsWith('Could not') || note.startsWith('Delete failed')

    return (
      <Box flexDirection="column">
        <Box borderStyle="round" borderColor={C.navy} paddingX={1} justifyContent="space-between">
          <Text bold color={C.gold}>◆ Sessions</Text>
          <Text color={C.ink}>
            {all.length} sessions · {new Set(all.map(s => s.cwd)).size} folders · {mb(total)}
          </Text>
        </Box>

        {Input && (
          <Box borderStyle="round" borderColor={found ? C.gold : C.ink} paddingX={1}>
            <Input
              key="filter"
              label="⌕ "
              placeholder="filter by title, folder, id · Enter searches transcripts"
              value={typed}
              submitLabel="search transcripts"
              onInput={(value: string) => {
                void update($, filter, () => value)
                void update($, hits, () => null)
              }}
              onSubmit={async (value: string) => {
                if (!value.trim()) return update($, hits, () => null)
                await say(`Searching transcripts for "${value}"…`)
                const { stdout } = await ps($, SEARCH, { QUERY: value })
                const ids = stdout.split(/\r?\n/).filter(Boolean)
                await update($, hits, () => ids)
                await say(`${ids.length} session${ids.length === 1 ? '' : 's'} mention "${value}".`)
              }}
            />
          </Box>
        )}

        <Box flexDirection="column" borderStyle="round" borderColor={C.navy} paddingX={1}>
          <Box justifyContent="space-between">
            <Text bold color={C.navy}>{found ? 'TRANSCRIPT MATCHES' : 'BY FOLDER'}</Text>
            <Text color={C.ink}>{shown.length === all.length ? `${all.length}` : `${shown.length} of ${all.length}`}</Text>
          </Box>
          {shown.length === 0 && <Text italic color={C.ink}>No sessions match.</Text>}
          {tree.map(g => (
            <Box flexDirection="column" marginTop={1}>
              <Text>
                <Text color={C.claret}>▾ </Text>
                <Text bold color={C.claret}>{folder(g.cwd)}</Text>
                <Text color={C.ink}>  {fit(g.cwd, Math.max(0, cols - folder(g.cwd).length - 10))}</Text>
              </Text>
              {g.list.map((s, i) => {
                const isPick = s.id === pick?.id
                const isLast = i === g.list.length - 1 && g.hidden === 0
                return (
                  <Button key={s.id} plain autoFocus={s.id === shown[0]?.id ? true : undefined} onPress={() => {
                    void update($, selected, () => s.id)
                    void update($, confirm, () => null)
                  }}>
                    <Text color={C.ink}>{isLast ? '└' : '├'}</Text>
                    <Text color={C.gold}>{isPick ? '▶' : ' '}</Text>
                    <Text color={freshness(s.time)}>●</Text>{' '}
                    <Text bold={isPick} color={isPick ? C.gold : undefined}>
                      {fit(s.id === me ? `${s.title} (this session)` : s.title, titleWidth)}
                    </Text>
                    <Text color={C.ink}> {age(s.time).padStart(4)} </Text>
                    <Text color={C.navy}>{spark(s.bytes, max)}</Text>
                    <Text color={C.ink}>{mb(s.bytes).padStart(8)}</Text>
                  </Button>
                )
              })}
              {g.hidden > 0 && <Text color={C.ink}>└ …{g.hidden} more</Text>}
            </Box>
          ))}
          {tree.length < groups.size && (
            <Text italic color={C.ink}>…{groups.size - tree.length} more folders; filter to narrow</Text>
          )}
        </Box>

        {pick && (
          <Box flexDirection="column" borderStyle="round" borderColor={isArmed ? C.claret : C.gold} paddingX={1}>
            <Text bold color={isArmed ? C.claret : C.gold}>{fit(pick.title, cols - 6)}</Text>
            <Text>
              <Text color={C.ink}>folder  </Text><Text>{pick.cwd}</Text>
            </Text>
            <Text>
              <Text color={C.ink}>id      </Text><Text>{pick.id}</Text>
            </Text>
            <Text>
              <Text color={C.ink}>used    </Text><Text>{new Date(pick.time).toLocaleString()}</Text>
              <Text color={C.ink}>  ·  {mb(pick.bytes)}</Text>
            </Text>
            <Box flexDirection="row" gap={1} marginTop={1} flexWrap="wrap">
              <Button hotkey="o" variant="primary" label="Open in tab"
                onPress={act('open', async () => say(await openTab($, pick)))} />
              <Button hotkey="f" label="Folder" onPress={act('folder', async () => {
                await ps($, 'Invoke-Item -LiteralPath $env:DIR', { DIR: pick.cwd })
              })} />
              <Button hotkey="c" label="Copy cmd" onPress={act('copy', async () => {
                const { isCopied } = await $.ui.copy({ text: resumeCmd(pick) })
                await say(isCopied ? 'Copied the resume command.' : resumeCmd(pick))
              })} />
              <Button hotkey="d" label={isArmed ? 'Press d again to delete' : 'Delete'}
                onPress={act('delete', async () => {
                  if (pick.id === me) return say('This is the current session; it cannot be deleted from here.')
                  if (!isArmed) return update($, confirm, () => `delete:${pick.id}`)
                  await update($, confirm, () => null)
                  await say(await recycle($, [pick.id]))
                })} />
            </Box>
          </Box>
        )}

        <Box justifyContent="space-between" paddingX={1}>
          <Box flexDirection="row" gap={2}>
            <Button hotkey="p" plain dimColor
              label={armed === 'prune' ? `press p again: prune ${old.length} >30d` : `prune >30d (${old.length})`}
              onPress={act('prune', async () => {
                if (old.length === 0) return say('No sessions older than 30 days.')
                if (armed !== 'prune') return update($, confirm, () => 'prune')
                await update($, confirm, () => null)
                await say(await recycle($, old.map(s => s.id)))
              })} />
            <Button hotkey="r" plain dimColor label="refresh" onPress={act('refresh', async () => {
              await say('Loading…')
              await load($)
              await say('')
            })} />
          </Box>
          <Text color={C.ink}>
            <Text color={C.sage}>●</Text> today  <Text color={C.gold}>●</Text> week  <Text color={C.ink}>●</Text> older
          </Text>
        </Box>
        {note !== '' && <Text color={isError ? C.claret : C.sage}> {note}</Text>}
      </Box>
    )
  })
}
