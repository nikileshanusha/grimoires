import type { RenderElement, RenderNode, RenderSurface } from 'claude-code'

import type {
  AgentRow,
  AutoMission,
  Counts,
  CustomAction,
  FeedItem,
  LiveSession,
  Measure,
  Note,
  PastSession,
  Todo,
  TrashItem,
  View,
} from '../types'
import { eta, fmtAgo, fmtDuration, fmtSize, fmtTimeOfDay, paceOf } from './eta'
import type { IconName } from './icons'
import { BUILT_IN_ACTIONS, HELPERS, helperOf } from './ops'
import type { Act } from './ops'
import { olderThan } from './cleanup'
import { CACHE_5M, cacheLeft } from './sessions'
import { flowWindow, nextLine, stepsFor } from './mission'
import { C, CHIP, GLYPH, bar, iconSvg, levelColor, metroSvg, ringSvg } from './visuals'
import type { MetroStep } from './visuals'
import type { ChipTone } from './visuals'

export type Data = {
  goal: string
  auto: AutoMission
  todos: Todo[]
  feed: FeedItem[]
  counts: Counts
  measure: Measure
  agents: AgentRow[]
  live: LiveSession[]
  past: PastSession[]
  trash: TrashItem[]
  notes: Note[]
  draftGen: number
  actions: CustomAction[]
  view: View
  now: number
  storedMedianMs?: number
  turnStartedAt: number
}

// What every card draws with: the surface's elements and a few helpers that
// draw the same idea richly (Svg) or plainly (terminal glyphs).
export type Kit = {
  act: Act
  surface: RenderSurface
  isRich: boolean
  // The element constructors differ per surface; cards use only those the
  // surface has (Svg only where isRich, Input and Select where hasInput).
  el: any
  hasInput: boolean
  icon: (name: IconName, color: string, size?: number) => RenderNode
  // Columns the pane has to draw in; layouts set it, cards size to it.
  cols: number
  chip: (text: string, tone: ChipTone | 'quiet') => RenderNode
  // Makes any icon or drawing pressable: `cols` x `rows` cells over it.
  tap: (key: string, node: RenderNode, onPress: () => void, cols?: number, rows?: number) => RenderNode
}

// Buttons hold only text, so a drawing is made pressable by laying blank,
// keyed buttons over it; on the terminal the glyph itself goes in the button.
const BLANK = '\u00A0'
function tapOver(el: any, isRich: boolean, key: string, node: RenderNode, onPress: () => void, cols = 2, rows = 1): RenderNode {
  const { Box, Button } = el
  if (!isRich) {
    return (
      <Button key={key} plain onPress={onPress}>
        {node}
      </Button>
    )
  }

  return (
    <Box position="relative" flexShrink={0}>
      {node}
      <Box position="absolute" top={0} left={0} flexDirection="column">
        {Array.from({ length: rows }, (_, i) => (
          <Button key={i === 0 ? key : `${key}-${i}`} plain onPress={onPress}>
            {BLANK.repeat(cols)}
          </Button>
        ))}
      </Box>
    </Box>
  )
}

export function makeKit(act: Act, surface: RenderSurface, el: any): Kit {
  const isRich = surface !== 'terminal'
  const { Svg, Text } = el

  return {
    act,
    surface,
    isRich,
    el,
    hasInput: surface !== 'mobile',
    cols: 120,
    icon: (name, color, size = 13) =>
      isRich ? (
        <Svg source={iconSvg(name, color, size)} alt={name.replace(/-/g, ' ')} width={size} height={size} />
      ) : (
        <Text color={color}>{GLYPH[name] ?? '·'}</Text>
      ),
    tap: (key, node, onPress, cols, rows) => tapOver(el, isRich, key, node, onPress, cols, rows),
    chip: (text, tone) =>
      tone === 'quiet' ? (
        <Text dimColor>{` ${text} `}</Text>
      ) : (
        <Text color={CHIP[tone].fg} backgroundColor={CHIP[tone].bg}>{` ${text} `}</Text>
      ),
  }
}

// ── Building blocks ────────────────────────────────────────────────────────

export function Card(k: Kit, opts: { icon: IconName; color: string; title: string; right?: RenderNode; accent?: boolean; grow?: number; width?: string }, body: RenderNode[]): RenderNode {
  const { Box } = k.el

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={opts.accent ? C.mission : "subtle"}
      paddingX={1}
      // A share of the row, never a fixed width: shares and gaps always fit.
      flexGrow={opts.width ? parseFloat(opts.width) : (opts.grow ?? 1)}
      flexShrink={1}
      width={opts.width ? 0 : undefined}
      minWidth={0}
      overflow="hidden"
    >
      {Header(k, opts.icon, opts.color, opts.title, opts.right)}
      {body}
    </Box>
  )
}

export function Header(k: Kit, icon: IconName, color: string, title: string, right?: RenderNode): RenderNode {
  const { Box, Text } = k.el

  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      {k.icon(icon, color, 14)}
      <Box flexShrink={0}>
        <Text bold>{title}</Text>
      </Box>
      <Box flexGrow={1} />
      {right ? (
        <Box flexShrink={1} minWidth={0} overflow="hidden" justifyContent="flex-end">
          {right}
        </Box>
      ) : null}
    </Box>
  )
}

// The one grid every list row sits on, in every card: a fixed icon column,
// the text stretching between, and a fixed right-aligned column for times
// and statuses, so rows line up down a card and across cards alike.
export const GRID = { icon: 2, meta: 12 } as const

export function IconCell(k: Kit, icon: RenderNode): RenderNode {
  const { Box } = k.el

  return (
    <Box width={GRID.icon} flexShrink={0} justifyContent="center" alignItems="center">
      {icon}
    </Box>
  )
}

export function MetaCell(k: Kit, meta: RenderNode, width: number = GRID.meta): RenderNode {
  const { Box } = k.el

  return (
    <Box width={width} flexShrink={0} justifyContent="flex-end" alignItems="center" overflow="hidden">
      {meta}
    </Box>
  )
}

function Row(k: Kit, icon: RenderNode, text: RenderNode, meta?: RenderNode, metaWidth: number = GRID.meta): RenderNode {
  const { Box } = k.el

  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      {IconCell(k, icon)}
      <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
        {text}
      </Box>
      {meta ? MetaCell(k, meta, metaWidth) : null}
    </Box>
  )
}

export function Gap(k: Kit): RenderNode {
  const { Box } = k.el

  return <Box height={1} />
}

function Pill(k: Kit, key: string, icon: IconName, color: string, label: string, onPress: () => void, tone?: string): RenderNode {
  const { Box, Button, Text } = k.el

  return (
    <Box flexDirection="row" gap={1} alignItems="center" flexShrink={0}>
      {k.tap(`${key}-icon`, k.icon(icon, color, 13), onPress)}
      <Button key={key} plain onPress={onPress}>
        <Text color={tone}>{label}</Text>
      </Button>
    </Box>
  )
}

function Link(k: Kit, key: string, label: string, onPress: () => void, color?: string): RenderNode {
  const { Button, Text } = k.el

  return (
    <Button key={key} plain onPress={onPress}>
      <Text color={color} dimColor={!color}>{label}</Text>
    </Button>
  )
}

function Confirm(k: Kit, key: string, message: string, yes: string, onYes: () => void): RenderNode {
  const { Box, Text } = k.el

  return (
    <Box flexDirection="row" gap={1} alignItems="center" borderStyle="round" borderColor={C.red} paddingX={1} marginTop={k.isRich ? 1 : 0}>
      {k.icon('alert-triangle', C.red, 14)}
      <Box flexGrow={1} minWidth={0} overflow="hidden">
        <Text color={C.redDeep} wrap="wrap">{message}</Text>
      </Box>
      {Link(k, `${key}-yes`, yes, onYes, C.red)}
      {Link(k, `${key}-no`, 'Cancel', () => k.act.cancelConfirm())}
    </Box>
  )
}

// ── Mission ────────────────────────────────────────────────────────────────

// The pinned mission wins; otherwise the one the conversation suggests.
export function missionText(d: Data): { text: string; isPinned: boolean } {
  if (d.goal) return { text: d.goal, isPinned: true }

  return { text: d.auto.mission, isPinned: false }
}

export function GoalNode(k: Kit, d: Data): RenderNode {
  const { Box, Text } = k.el
  const { text, isPinned } = missionText(d)
  if (!text) {
    return <Text dimColor italic>Your mission appears here as the conversation takes shape. Pin your own with /mission.</Text>
  }

  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      <Box flexGrow={1} minWidth={0} overflow="hidden">
        <Text bold color={C.mission} wrap="truncate-end">
          {text}
        </Text>
      </Box>
      {isPinned ? k.chip('pinned', 'violet') : k.chip('auto', 'quiet')}
      {isPinned
        ? Link(k, 'mission-unpin', 'Unpin', () => k.act.unpinMission())
        : Link(k, 'mission-pin', 'Pin', () => k.act.pinMission(text), C.mission)}
    </Box>
  )
}

const STEP_COLOR = { done: C.teal, now: C.mission, next: C.muted } as const
const STEP_GLYPH = { done: '✓', now: '●', next: '○' } as const

// Each shown step with what it took, has taken, or should take.
function withMeta(d: Data, shown: readonly { label: string; status: 'done' | 'now' | 'next' }[]): MetroStep[] {
  const est = eta(d.todos, d.now, d.storedMedianMs)
  const todoOf = (label: string) => d.todos.find(t => t.content === label)

  return shown.map(step => {
    const todo = todoOf(step.label)
    let meta: string | undefined
    if (step.status === 'done' && todo?.startedAt !== undefined && todo.doneAt !== undefined) meta = `took ${fmtDuration(todo.doneAt - todo.startedAt)}`
    else if (step.status === 'now' && todo?.startedAt !== undefined) meta = `${fmtDuration(d.now - todo.startedAt)}${est.perTaskMs ? ` · ~${fmtDuration(est.perTaskMs)}` : ''}`
    else if (step.status === 'next' && est.perTaskMs) meta = `~${fmtDuration(est.perTaskMs)}`

    return { label: step.status === 'now' && todo ? todo.activeForm : step.label, status: step.status, meta }
  })
}

// The way to the mission: a metro line where the surface draws pictures,
// a text timeline on the terminal.
export function BarNode(k: Kit, d: Data, max = 5): RenderNode | null {
  const { Box, Svg } = k.el
  const steps = stepsFor(d.todos, d.auto)
  if (steps.length === 0) return null
  const back = d.view.flowOffset ?? 0
  const { before, after } = flowWindow(steps, max, back)
  const body = (() => {
    if (!k.isRich) return <Box flexDirection="column">{Timeline(k, d, max)}</Box>
    const { shown } = flowWindow(steps, max, back)
    const source = metroSvg(withMeta(d, shown), before, after, 400)
    const alt = shown.map(s => `${s.status}: ${s.label}`).join(', ')

    // No fixed size: the picture keeps its own size where it fits and scales
    // down to the card where it does not, never past the card's edge.
    return (
      <Box minWidth={0} overflow="hidden">
        <Svg source={source} alt={alt} />
      </Box>
    )
  })()

  // The controls sit above the picture: earlier steps are above, and a
  // picture taller than its box can never cover them there.
  return (
    <Box flexDirection="column" marginY={k.isRich ? 1 : 0}>
      {FlowScroll(k, back, before, after)}
      {body}
    </Box>
  )
}

// Steps through the path: older steps above, back to the present below.
function FlowScroll(k: Kit, back: number, before: number, after: number): RenderNode | null {
  const { Box } = k.el
  if (before === 0 && back === 0) return null

  return (
    <Box flexDirection="row" gap={2} paddingLeft={1}>
      {before > 0 ? Link(k, 'flow-earlier', `▲ Earlier (${before})`, () => k.act.setView({ flowOffset: back + 1 }), C.teal) : null}
      {back > 0 ? Link(k, 'flow-later', '▼ Later', () => k.act.setView({ flowOffset: back - 1 })) : null}
      {back > 0 && after > 0 ? Link(k, 'flow-now', 'Back to now', () => k.act.setView({ flowOffset: 0 }), C.mission) : null}
    </Box>
  )
}

// The path as a vertical timeline for tall layouts: a rail of steps, each
// with what it took or is expected to take.
export function Timeline(k: Kit, d: Data, max = 8): RenderNode[] {
  const { Box, Text } = k.el
  const steps = stepsFor(d.todos, d.auto)
  if (steps.length === 0) return []
  const { shown, before, after } = flowWindow(steps, max, d.view.flowOffset ?? 0)
  const est = eta(d.todos, d.now, d.storedMedianMs)
  const todoOf = (label: string) => d.todos.find(t => t.content === label)
  const rows: RenderNode[] = []
  const rail = (color: string) => (
    <Box width={GRID.icon} justifyContent="center">
      <Text color={color}>│</Text>
    </Box>
  )
  if (before > 0) {
    rows.push(Row(k, <Text color={C.teal}>✓</Text>, <Text color={C.teal}>{`${before} earlier step${before === 1 ? '' : 's'} done`}</Text>))
    rows.push(rail(C.teal))
  }
  shown.forEach((step, i) => {
    const todo = todoOf(step.label)
    const isNow = step.status === 'now'
    let meta = ''
    if (step.status === 'done' && todo?.startedAt !== undefined && todo.doneAt !== undefined) meta = `took ${fmtDuration(todo.doneAt - todo.startedAt)}`
    else if (isNow && todo?.startedAt !== undefined) meta = `${fmtDuration(d.now - todo.startedAt)}${est.perTaskMs ? ` · ~${fmtDuration(est.perTaskMs)}` : ''}`
    else if (step.status === 'next' && est.perTaskMs) meta = `~${fmtDuration(est.perTaskMs)}`
    rows.push(
      <Box flexDirection="row" gap={1} alignItems="center">
        {IconCell(
          k,
          <Text color={STEP_COLOR[step.status]} bold>
            {STEP_GLYPH[step.status]}
          </Text>,
        )}
        <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
          <Text wrap="truncate-end" bold={isNow} color={isNow ? C.mission : undefined} dimColor={step.status !== 'now'}>
            {isNow && todo ? todo.activeForm : step.label}
          </Text>
        </Box>
        {MetaCell(k, isNow ? k.chip(meta || 'now', 'violet') : <Text dimColor>{meta}</Text>, 16)}
      </Box>,
    )
    if (i < shown.length - 1) rows.push(rail(step.status === 'done' ? C.teal : C.muted))
  })
  if (after > 0) {
    rows.push(rail(C.muted))
    rows.push(Row(k, <Text dimColor>○</Text>, <Text dimColor>{`${after} more step${after === 1 ? '' : 's'}`}</Text>))
  }

  return rows
}

// Two plain lines under the diagram: what's happening, what's coming.
export function NowNextNode(k: Kit, d: Data): RenderNode[] {
  const { Box, Text } = k.el
  const steps = stepsFor(d.todos, d.auto)
  const current = d.todos.find(t => t.status === 'in_progress')
  const nowLabel = current?.activeForm ?? steps.find(s => s.status === 'now')?.label
  const spent = current?.startedAt !== undefined ? fmtDuration(d.now - current.startedAt) : d.turnStartedAt > 0 ? fmtDuration(d.now - d.turnStartedAt) : undefined
  const next = nextLine(steps)
  const rows: RenderNode[] = []
  const line = (label: string, color: string, text: string, meta?: string) => (
    <Box flexDirection="row" gap={1}>
      <Box width={5}>
        <Text color={color}>{label}</Text>
      </Box>
      <Box flexGrow={1} minWidth={0} overflow="hidden">
        <Text wrap="truncate-end">{text}</Text>
      </Box>
      {meta ? <Text dimColor>{meta}</Text> : null}
    </Box>
  )
  if (nowLabel || d.turnStartedAt > 0) rows.push(line('Now', C.mission, nowLabel ?? 'Working', spent))
  if (next) rows.push(line('Next', C.muted, next))

  return rows
}

export function TaskRows(k: Kit, d: Data, maxTasks: number): RenderNode[] {
  const { Text } = k.el
  if (d.todos.length === 0) {
    if (d.turnStartedAt > 0) return [Row(k, k.icon('progress', C.mission), <Text>Working…</Text>, <Text dimColor>{fmtDuration(d.now - d.turnStartedAt)}</Text>)]

    return [<Text dimColor>Tasks appear here when Claude plans the work.</Text>]
  }
  const est = eta(d.todos, d.now, d.storedMedianMs)
  // A window around the current task: the last done, the current, what's next.
  const at = Math.max(0, d.todos.findIndex(t => t.status !== 'completed'))
  const start = Math.max(0, Math.min(at - 1, d.todos.length - maxTasks))
  const shown = d.todos.slice(start, start + maxTasks)
  const rows: RenderNode[] = shown.map(t => {
    const isCurrent = t.status === 'in_progress'
    const isDone = t.status === 'completed'
    const took = t.startedAt !== undefined && t.doneAt !== undefined ? `took ${fmtDuration(t.doneAt - t.startedAt)}` : 'done'
    const spent = isCurrent && t.startedAt !== undefined ? fmtDuration(d.now - t.startedAt) : undefined

    return Row(
      k,
      k.icon(isDone ? 'circle-check' : isCurrent ? 'progress' : 'circle-dashed', isDone ? C.teal : isCurrent ? C.mission : C.muted),
      <Text wrap="truncate-end" dimColor={isDone} strikethrough={isDone} bold={isCurrent}>
        {isCurrent ? t.activeForm : t.content}
      </Text>,
      isDone ? (
        <Text dimColor>{took}</Text>
      ) : isCurrent ? (
        k.chip(est.perTaskMs ? `${spent ?? '0s'} · ~${fmtDuration(est.perTaskMs)}` : (spent ?? 'now'), 'violet')
      ) : (
        <Text dimColor>{est.perTaskMs ? `~${fmtDuration(est.perTaskMs)}` : ''}</Text>
      ),
    )
  })
  const more = d.todos.length - (start + shown.length)
  if (more > 0) rows.push(<Text dimColor>{`   + ${more} more`}</Text>)

  return rows
}

// Mission and the way there. The diagram carries now and next itself; the
// Now/Next lines stand in only while there are no steps yet.
export function MissionBody(k: Kit, d: Data, maxTasks: number): RenderNode[] {
  const rows: RenderNode[] = [GoalNode(k, d)]
  const flow = BarNode(k, d, maxTasks >= 8 ? 7 : maxTasks === 0 ? 3 : 5)
  if (flow) rows.push(flow)
  else rows.push(...NowNextNode(k, d))

  return rows
}

export function etaText(d: Data): RenderNode | undefined {
  const est = eta(d.todos, d.now, d.storedMedianMs)
  if (est.total === 0) return undefined
  if (est.done === est.total) return 'all done'
  if (est.leftMs === undefined || est.finishAt === undefined) return `${est.done} of ${est.total} · estimating…`

  return `~${fmtDuration(est.leftMs)} left · done ~${fmtTimeOfDay(est.finishAt)}`
}

export function MissionCard(k: Kit, d: Data, maxTasks = 5, width?: string): RenderNode {
  const { Box, Text } = k.el
  const right = etaText(d)

  return Card(
    k,
    {
      icon: 'target-arrow',
      color: C.mission,
      title: 'Mission',
      accent: true,
      width,
      right: right ? (
        <Box flexDirection="row" gap={1} alignItems="center">
          {k.icon('hourglass', C.mission, 13)}
          <Text dimColor>{right}</Text>
        </Box>
      ) : undefined,
    },
    MissionBody(k, d, maxTasks),
  )
}

// ── Gauges ─────────────────────────────────────────────────────────────────

type Gauge = { label: string; icon: IconName; percent: number; calm: string; resetsAt?: string }

function gaugesOf(m: Measure): Gauge[] {
  const out: Gauge[] = []
  if (m.context !== undefined) out.push({ label: 'Context', icon: 'stack-2', percent: m.context, calm: C.mission })
  for (const limit of m.limits) {
    const isWeek = /week|7d|seven/i.test(limit.kind)
    out.push({
      label: isWeek ? 'Weekly' : /5h|five|session|hour/i.test(limit.kind) ? '5h' : limit.kind,
      icon: isWeek ? 'calendar-week' : 'clock-hour-5',
      percent: limit.percent,
      calm: isWeek ? C.green : C.teal,
      resetsAt: limit.resetsAt,
    })
  }

  return out.slice(0, 3)
}

// When a window resets, short: "4:30 pm", or "Fri 9:00 am" a day or more out.
export function resetShort(resetsAt: string | undefined, now: number): string | undefined {
  const at = resetsAt ? Date.parse(resetsAt) : NaN
  if (!Number.isFinite(at)) return undefined
  if (at <= now) return 'now'
  const sameDay = new Date(at).toDateString() === new Date(now).toDateString()

  return sameDay ? fmtTimeOfDay(at) : `${new Date(at).toLocaleDateString('en-US', { weekday: 'short' })} ${fmtTimeOfDay(at)}`
}

// What pressing a gauge says: the figure in words, and when it resets.
export function limitDetail(g: { label: string; percent: number; resetsAt?: string }, now: number): string {
  const pct = Math.round(g.percent)
  if (g.label === 'Context') return `Context window ${pct}% full.${pct >= 70 ? ' A /compact soon keeps things sharp.' : ''}`
  if (g.label === 'Weekly') {
    const pace = paceOf(g.percent, g.resetsAt, now)
    const at = g.resetsAt ? Date.parse(g.resetsAt) : NaN
    const gone = Number.isFinite(at) ? Math.round(Math.min(100, Math.max(0, (1 - (at - now) / (7 * 86_400_000)) * 100))) : undefined

    return gone !== undefined && pace ? `Weekly limit: ${pct}% used with ${gone}% of the week gone: ${pace.text}.` : `Weekly limit: ${pct}% used.`
  }
  const resets = g.resetsAt ? ` Resets ${resetText(g.resetsAt, now)}.` : ' No reset time reported yet.'

  return `${g.label} limit: ${pct}% used.${resets}`
}

// The small note beside a gauge: the weekly window says how the pace is
// going (its reset day is known), the others when they reset.
export function gaugeNote(g: { label: string; percent: number; resetsAt?: string }, now: number): { text: string; color?: string } | undefined {
  if (g.label === 'Weekly') {
    const pace = paceOf(g.percent, g.resetsAt, now)
    if (!pace) return undefined

    return { text: pace.text, color: pace.diff >= 10 ? C.amber : undefined }
  }
  const resets = resetShort(g.resetsAt, now)

  return resets ? { text: `resets ${resets}` } : undefined
}

export function GaugesBody(k: Kit, d: Data, compact = false): RenderNode[] {
  const { Box, Button, Text, Svg } = k.el
  const gauges = gaugesOf(d.measure)
  if (gauges.length === 0) return [<Text dimColor>Limits show after the first reply.</Text>]

  if (!k.isRich) {
    return gauges.map(g => {
      const note = gaugeNote(g, d.now)
      const about = () => k.act.aboutLimit(limitDetail(g, d.now))

      return Row(k, k.tap(`gauge-icon-${g.label}`, k.icon(g.icon, levelColor(g.percent, g.calm)), about), <Text>{note ? `${g.label} · ${note.text}` : g.label}</Text>, (
        <Button key={`gauge-figure-${g.label}`} plain onPress={about}>
          <Text color={levelColor(g.percent, g.calm)}>{`${bar(g.percent, 10)} ${Math.round(g.percent)}%`}</Text>
        </Button>
      ))
    })
  }

  // A narrow card lists the gauges, one per row on the shared grid: a small
  // ring, the name and when it resets, then the figure.
  if (k.cols < GAUGE_TILES_FROM) {
    return gauges.map(g => {
      const color = levelColor(g.percent, g.calm)
      const note = gaugeNote(g, d.now)
      const about = () => k.act.aboutLimit(limitDetail(g, d.now))

      // Too small for a figure inside: the figure stands at the row's end.
      return Row(
        k,
        k.tap(`gauge-ring-${g.label}`, <Svg source={ringSvg(g.percent, color, 18, false)} alt={`${g.label} ${Math.round(g.percent)} percent`} width={18} height={18} />, about),
        <Button key={`gauge-name-${g.label}`} plain onPress={about}>
          <Text wrap="truncate-end">
            {g.label}
            {note ? <Text dimColor={!note.color} color={note.color}>{` · ${note.text}`}</Text> : ''}
          </Text>
        </Button>,
        <Button key={`gauge-figure-${g.label}`} plain onPress={about}>
          <Text color={color}>{`${Math.round(g.percent)}%`}</Text>
        </Button>,
        5,
      )
    })
  }

  // Wider: tiles of one fixed width that wrap to a new line, never overlap.
  // Large enough that the figure inside reads at a glance.
  const size = compact ? 44 : 56

  return [
    <Box flexDirection="row" flexWrap="wrap" justifyContent="space-around" columnGap={2} rowGap={1}>
      {gauges.map(g => {
        const note = gaugeNote(g, d.now)
        const about = () => k.act.aboutLimit(limitDetail(g, d.now))
        // The ring and the figure inside it: about 8 pixels a cell, 16 a row.
        const ring = <Svg source={ringSvg(g.percent, levelColor(g.percent, g.calm), size)} alt={`${g.label} ${Math.round(g.percent)} percent`} width={size} height={size} />

        return (
          <Box flexDirection="column" alignItems="center" width={GAUGE_TILE} flexShrink={0}>
            {k.tap(`gauge-ring-${g.label}`, ring, about, Math.ceil(size / 8), Math.ceil(size / 16))}
            <Box flexDirection="row" gap={1} alignItems="center" width={GAUGE_TILE} justifyContent="center" overflow="hidden">
              {k.tap(`gauge-icon-${g.label}`, k.icon(g.icon, g.calm, 12), about)}
              <Button key={`gauge-name-${g.label}`} plain onPress={about}>
                <Text dimColor wrap="truncate-end">{g.label}</Text>
              </Button>
            </Box>
            {note ? <Text dimColor={!note.color} color={note.color} wrap="truncate-end">{note.text}</Text> : null}
          </Box>
        )
      })}
    </Box>,
  ]
}

// Under this many columns the gauges list as rows; a tile is this wide.
const GAUGE_TILES_FROM = 64
const GAUGE_TILE = 14

// ── Actions ────────────────────────────────────────────────────────────────

export function ActionsBody(k: Kit, d: Data): RenderNode[] {
  const { Box } = k.el
  const pills = [
    ...BUILT_IN_ACTIONS.map(a => Pill(k, `act-${a.id}`, a.icon, a.color, a.label, () => k.act.submit(a.prompt))),
    ...d.actions.map((a, i) => Pill(k, `act-custom-${i}`, 'sparkles', C.amber, a.label, () => k.act.submit(a.prompt))),
  ]

  return [
    <Box flexDirection="row" flexWrap="wrap" columnGap={3} rowGap={0}>
      {pills}
    </Box>,
  ]
}

// ── Notes ──────────────────────────────────────────────────────────────────

export function NoteComposer(k: Kit, d: Data): RenderNode {
  const { Box, Input, Text } = k.el
  if (!k.hasInput) return <Text dimColor>Add notes with /note.</Text>

  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      {k.icon('plus', C.pink, 13)}
      <Box flexGrow={1} minWidth={0} overflow="hidden">
        <Input
          key={`note-draft-${d.draftGen}`}
          placeholder="New note… Enter saves it"
          submitLabel="Save"
          onInput={(v: string) => k.act.setDraft(v)}
          onSubmit={(v: string) => k.act.saveNote(v)}
        />
      </Box>
      {Link(k, 'note-send-draft', 'Save & send to Claude', () => k.act.sendDraft(), C.mission)}
    </Box>
  )
}

export function NotesBody(k: Kit, d: Data, max = 3): RenderNode[] {
  const { Box, Text } = k.el
  const rows: RenderNode[] = [NoteComposer(k, d)]
  for (const n of d.notes.slice(0, max)) {
    rows.push(
      Row(
        k,
        k.icon('point', C.pink),
        <Text wrap="truncate-end">{n.text}</Text>,
        <Box flexDirection="row" gap={1}>
          <Text dimColor>{fmtAgo(d.now - n.at).replace('just now', 'now')}</Text>
          {Link(k, `note-send-${n.id}`, 'send', () => k.act.submit(n.text), C.mission)}
          {Link(k, `note-del-${n.id}`, '×', () => k.act.removeNote(n.id))}
        </Box>,
        18,
      ),
    )
  }
  const footer: RenderNode[] = []
  if (d.notes.length > max) footer.push(<Text dimColor>{`+ ${d.notes.length - max} more`}</Text>)
  if (d.notes.length > 0) {
    footer.push(<Box flexGrow={1} />)
    footer.push(k.tap('notes-open-icon', k.icon('file-text', C.pink, 12), () => k.act.openNotes()))
    footer.push(Link(k, 'notes-open', 'Open notes file', () => k.act.openNotes()))
  }
  if (footer.length > 0) {
    rows.push(
      <Box flexDirection="row" gap={1} alignItems="center">
        {footer}
      </Box>,
    )
  }

  return rows
}

// ── Activity ───────────────────────────────────────────────────────────────

const KIND: Record<FeedItem['kind'], { icon: IconName; color: string }> = {
  edit: { icon: 'pencil', color: C.indigo },
  run: { icon: 'terminal', color: C.amber },
  read: { icon: 'file-search', color: C.blue },
  agent: { icon: 'robot', color: C.blue },
  tool: { icon: 'tool', color: C.muted },
}

export function countsText(c: Counts): string {
  return `${c.edits} edit${c.edits === 1 ? '' : 's'} · ${c.runs} run${c.runs === 1 ? '' : 's'} · ${c.errors === 0 ? 'no errors' : `${c.errors} error${c.errors === 1 ? '' : 's'}`}`
}

type FeedGroup = { verb: string; kind: FeedItem['kind']; targets: string[]; first: FeedItem; last: FeedItem; count: number }

// Calm the feed: back-to-back finished calls of the same verb fold into one
// row ("Read 4 files"); anything running or failed always stands alone.
export function groupFeed(feed: readonly FeedItem[], max: number): FeedGroup[] {
  const groups: FeedGroup[] = []
  for (let i = feed.length - 1; i >= 0 && groups.length < max; i--) {
    const item = feed[i] as FeedItem
    const prev = groups[groups.length - 1]
    const isSettled = item.endedAt !== undefined && !item.isError
    if (prev && isSettled && prev.verb === item.verb && prev.last.why === item.why && prev.last.endedAt !== undefined && !prev.last.isError && prev.count < 20) {
      prev.count += 1
      prev.first = item
      if (!prev.targets.includes(item.label)) prev.targets.push(item.label)
      continue
    }
    groups.push({ verb: item.verb, kind: item.kind, targets: [item.label], first: item, last: item, count: 1 })
  }

  return groups
}

const PLURAL: Record<string, string> = { Read: 'files', Edited: 'files', Wrote: 'files', Searched: 'searches', Ran: 'commands', Found: 'patterns', Fetched: 'pages' }

// One short line per thing done: what, to what, and how it went. A click
// opens the details beneath it; another click folds them away.
export function shortLine(g: { verb: string; targets: string[]; count: number }): string {
  const what =
    g.count > 1
      ? `${g.count} ${PLURAL[g.verb] ?? 'times'}`
      : g.targets[0] ?? ''

  return what ? `${g.verb} ${what}` : g.verb
}

export function ActivityBody(k: Kit, d: Data, max = 5): RenderNode[] {
  const { Box, Button, Text } = k.el
  if (d.feed.length === 0) return [<Text dimColor>What Claude does shows up here.</Text>]

  return groupFeed(d.feed, max).map(g => {
    const kind = KIND[g.kind]
    const item = g.last
    const id = item.id
    const isOpen = d.view.openActivity === id
    const toggle = () => k.act.setView({ openActivity: isOpen ? undefined : id })
    const isRunning = item.endedAt === undefined
    const took = item.endedAt !== undefined ? item.endedAt - item.startedAt : 0
    const status = isRunning ? (
      <Text color={C.amber}>running</Text>
    ) : item.isError ? (
      <Text color={C.red}>failed</Text>
    ) : (
      <Text color={C.teal}>{took >= 1500 ? `✓ ${fmtDuration(took)}` : '✓'}</Text>
    )

    const head = (
      <Box flexDirection="row" gap={1} alignItems={isOpen ? 'flex-start' : 'center'}>
        {IconCell(k, k.tap(`feed-icon-${id}`, item.isError ? k.icon('alert-triangle', C.red) : k.icon(kind.icon, kind.color), toggle))}
        <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
          {/* Folded: one line, cut with an ellipsis. Open: the whole sentence. */}
          <Button key={`feed-${id}`} plain onPress={toggle}>
            <Text color={isOpen ? kind.color : undefined} bold={isOpen} wrap={isOpen ? 'wrap' : 'truncate-end'}>
              {shortLine(g)}
            </Text>
          </Button>
        </Box>
        <Box width={GRID.icon} flexShrink={0} justifyContent="center">
          <Button key={`feed-chevron-${id}`} plain onPress={toggle}>
            <Text color={isOpen ? kind.color : C.muted} bold>{isOpen ? '−' : '+'}</Text>
          </Button>
        </Box>
        {MetaCell(k, status, 7)}
      </Box>
    )
    if (!isOpen) return head

    // The details: why, how, what came back, and what to do with it.
    // The full sentence leads: the row above can only show one line of it.
    const lines: RenderNode[] = [
      <Text bold color={kind.color} wrap="wrap">
        {shortLine(g)}
      </Text>,
    ]
    if (item.why) lines.push(<Text italic wrap="wrap">{item.why}</Text>)
    if (g.count > 1) lines.push(<Text dimColor wrap="wrap">{g.targets.join(', ')}</Text>)
    else if (item.detail) lines.push(<Text dimColor wrap="wrap">{item.detail}</Text>)
    if (item.out) lines.push(<Text dimColor wrap="wrap">{item.out}</Text>)
    const ago = fmtAgo(d.now - (item.endedAt ?? d.now))
    lines.push(<Text dimColor>{isRunning ? 'still running' : `took ${fmtDuration(took)} · ${ago === 'just now' ? ago : `${ago} ago`}`}</Text>,
    )
    const command = g.kind === 'run' ? item.detail ?? (item.label || undefined) : undefined

    return (
      <Box flexDirection="column">
        {head}
        <Box flexDirection="column" borderStyle="round" borderColor={kind.color} paddingX={1} marginLeft={GRID.icon + 1} marginBottom={k.isRich ? 1 : 0}>
          {lines}
          <Box flexDirection="row" gap={2}>
            {command ? Link(k, `feed-copy-${id}`, 'Copy command', () => k.act.copy(command), kind.color) : null}
            {Link(k, `feed-explain-${id}`, 'Explain', () => k.act.submit(`In two or three sentences: what did "${shortLine(g)}" do, why, and what did it show?`), C.mission)}
            {Link(k, `feed-close-${id}`, 'Close', () => k.act.setView({ openActivity: undefined }))}
          </Box>
        </Box>
      </Box>
    )
  })
}

// ── Agents ─────────────────────────────────────────────────────────────────

export function agentsRunning(d: Data): number {
  return d.agents.filter(a => a.endedAt === undefined).length
}

export function AgentsBody(k: Kit, d: Data, max = 4): RenderNode[] {
  const { Box, Text, Input, Select } = k.el
  const rows: RenderNode[] = d.agents.slice(0, max).map(a => {
    const h = helperOf(a.type)
    const isDone = a.endedAt !== undefined
    const isFailed = a.status === 'failed' || a.status === 'killed'

    return Row(
      k,
      k.icon(h.icon, h.color),
      <Text wrap="truncate-end" dimColor={isDone}>{a.description || h.label}</Text>,
      isDone ? (
        isFailed ? k.icon('x', C.red, 13) : k.icon('check', C.teal, 13)
      ) : (
        <Text dimColor>{fmtDuration(d.now - a.firstSeenAt)}</Text>
      ),
    )
  })
  if (rows.length === 0) rows.push(<Text dimColor>No agents yet. Hand a small job to a helper below.</Text>)

  if (k.hasInput) {
    rows.push(
      <Box flexDirection="row" gap={1} alignItems="center" marginTop={k.isRich ? 1 : 0}>
        {k.icon(HELPERS[d.view.helper]?.icon ?? 'binoculars', HELPERS[d.view.helper]?.color ?? C.teal, 14)}
        <Select
          key="spawn-helper"
          value={d.view.helper}
          options={Object.entries(HELPERS).map(([value, h]) => ({ value, label: h.label }))}
          onSelect={(v: string) => k.act.setView({ helper: v })}
        />
        <Box flexGrow={1} minWidth={0} overflow="hidden">
          <Input key="spawn-input" placeholder="Ask a helper to…" submitLabel="Send" onSubmit={(v: string) => k.act.spawn(d.view.helper, v)} />
        </Box>
      </Box>,
    )
  }

  return rows
}

// ── Sessions ───────────────────────────────────────────────────────────────

const ENTRY: Record<LiveSession['entry'], { icon: IconName; color: string }> = {
  terminal: { icon: 'terminal-2', color: C.coral },
  ide: { icon: 'brand-vscode', color: C.pink },
  desktop: { icon: 'device-desktop', color: C.blue },
}

export function SessionsTabs(k: Kit, d: Data): RenderNode {
  const { Box, Button, Text } = k.el
  const tabs = [
    { id: 'live', label: `Live ${d.live.length}` },
    { id: 'past', label: `Past ${d.past.length}` },
    { id: 'trash', label: `Trash ${d.trash.length}` },
  ] as const

  return (
    <Box flexDirection="row" gap={1}>
      {tabs.map(t => (
        <Button
          key={`tab-${t.id}`}
          plain
          onPress={() => {
            k.act.setView({ sessionsTab: t.id, confirm: undefined, pastPage: 0 })
            if (t.id === 'past') k.act.refreshPast()
          }}
        >
          <Text color={d.view.sessionsTab === t.id ? C.coral : undefined} dimColor={d.view.sessionsTab !== t.id} underline={d.view.sessionsTab === t.id}>
            {t.label}
          </Text>
        </Button>
      ))}
    </Box>
  )
}

// Fixed columns so every row lines up: only the title stretches.
const COL = { project: 12, when: 5, size: 8, cache: 9, status: 11, action: 8 } as const
// Under this many columns a card drops the project and size columns.
const WIDE_SESSIONS = 70

function Cell(k: Kit, width: number, node: RenderNode, align: 'flex-start' | 'flex-end' = 'flex-start'): RenderNode {
  const { Box } = k.el

  return (
    <Box width={width} flexShrink={0} justifyContent={align} minWidth={0}>
      {node}
    </Box>
  )
}

function SessionLine(k: Kit, icon: RenderNode, cells: RenderNode[]): RenderNode {
  const { Box } = k.el

  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      {IconCell(k, icon)}
      {cells}
    </Box>
  )
}

function Stretch(k: Kit, node: RenderNode): RenderNode {
  const { Box } = k.el

  return (
    <Box flexGrow={1} flexShrink={1} minWidth={0}>
      {node}
    </Box>
  )
}

function ColumnHeads(k: Kit, withSize: boolean, isWide: boolean): RenderNode {
  const { Text } = k.el
  const head = (t: string) => <Text dimColor>{t}</Text>

  return SessionLine(k, <Text> </Text>, [
    ...(isWide ? [Cell(k, COL.project, head('Project'))] : []),
    Stretch(k, head('Session')),
    Cell(k, COL.when, head('When'), 'flex-end'),
    ...(withSize && isWide ? [Cell(k, COL.size, head('Size'), 'flex-end')] : []),
    ...(withSize ? [Cell(k, COL.cache, head('Cache'), 'flex-end')] : []),
    Cell(k, COL.action, <Text> </Text>),
  ])
}

// `room` is the columns this card gets; narrow cards keep only the session,
// when, and the action, with the project folded into the title.
export function SessionsBody(k: Kit, d: Data, max = 4, room = k.cols): RenderNode[] {
  const { Box, Text } = k.el
  const tab = d.view.sessionsTab
  const isWide = room >= WIDE_SESSIONS
  // One line of text, never two: a narrow card folds the project in front.
  const titled = (project: string, title: string, isDim = false) => (
    <Text wrap="truncate-end" dimColor={isDim}>
      {!isWide && project ? `${project} · ${title}` : title}
    </Text>
  )
  const ago = (ms: number) => fmtAgo(ms).replace('just now', 'now')
  // Warm while the prompt cache still holds the conversation: the next
  // message there is cheap and quick. Cold means it re-reads everything.
  const cache = (lastAt: number | undefined, ttlMs: number | undefined, isBusy = false, quietCold = false) => {
    const left = isBusy ? 1 : cacheLeft(lastAt, d.now, ttlMs ?? CACHE_5M)
    if (left > 0) return <Text color={C.teal} wrap="truncate-end">{isBusy ? 'warm' : `warm ${fmtDuration(left)}`}</Text>

    return <Text dimColor>{quietCold ? '—' : 'cold'}</Text>
  }
  const rows: RenderNode[] = []
  const trunc = (t: string) => <Text wrap="truncate-end">{t}</Text>
  const dim = (t: string) => (
    <Text dimColor wrap="truncate-end">
      {t}
    </Text>
  )

  if (tab === 'live') {
    // This session always leads, even before the registry has been read.
    const here: LiveSession = { pid: 0, sessionId: '', name: 'This session', cwd: '', entry: 'desktop', isBusy: false, since: d.now, isHere: true }
    const list = d.live.some(s => s.isHere) ? d.live : [here, ...d.live]
    const head = (t: string) => <Text dimColor>{t}</Text>
    rows.push(
      SessionLine(k, <Text> </Text>, [
        Stretch(k, head('Session')),
        Cell(k, COL.cache, head('Cache'), 'flex-end'),
        Cell(k, COL.status, head('Status'), 'flex-end'),
        Cell(k, COL.action, <Text> </Text>),
      ]),
    )
    for (const s of list.slice(0, max)) {
      const entry = s.isHere ? { icon: 'point' as IconName, color: C.mission } : ENTRY[s.entry]
      const status = s.isHere
        ? k.chip('here', 'violet')
        : s.isBusy
          ? k.chip(`busy ${fmtAgo(d.now - s.since).replace('just now', '<1m')}`, 'coral')
          : k.chip('idle', 'quiet')
      rows.push(
        SessionLine(k, k.icon(entry.icon, entry.color), [
          Stretch(k, trunc(s.isHere ? 'This session' : s.name)),
          Cell(k, COL.cache, cache(s.lastAt, s.cacheTtlMs, s.isBusy), 'flex-end'),
          Cell(k, COL.status, status, 'flex-end'),
          Cell(k, COL.action, s.isHere ? Link(k, 'clear-here', 'Clear', () => k.act.askConfirm('clear'), C.redDeep) : <Text> </Text>, 'flex-end'),
        ]),
      )
    }
    if (list.length > max) rows.push(<Text dimColor>{`+ ${list.length - max} more`}</Text>)
    if (d.view.confirm === 'clear') {
      rows.push(Confirm(k, 'confirm-clear', 'Clear this chat? Your goal, notes and helpers stay.', 'Clear', () => k.act.clearSession()))
    }
  }

  if (tab === 'past') {
    const page = d.view.pastPage
    const slice = d.past.slice(page * max, page * max + max)
    if (d.past.length === 0) rows.push(<Text dimColor>No past sessions found.</Text>)
    else rows.push(ColumnHeads(k, true, isWide))
    for (const s of slice) {
      const isAsking = d.view.confirm === `delete:${s.path}`
      rows.push(
        SessionLine(k, k.icon('history', C.coral), [
          ...(isWide ? [Cell(k, COL.project, dim(s.project || '—'))] : []),
          Stretch(k, titled(s.project, s.title)),
          Cell(k, COL.when, dim(ago(d.now - s.mtimeMs)), 'flex-end'),
          ...(isWide ? [Cell(k, COL.size, dim(fmtSize(s.size)), 'flex-end')] : []),
          Cell(k, COL.cache, cache(s.mtimeMs, s.cacheTtlMs, false, true), 'flex-end'),
          Cell(
            k,
            COL.action,
            s.isLive ? k.chip('running', 'coral') : Link(k, `del-${s.sessionId}`, 'Delete', () => k.act.askConfirm(`delete:${s.path}`), C.redDeep),
            'flex-end',
          ),
        ]),
      )
      if (isAsking) {
        rows.push(Confirm(k, `confirm-del-${s.sessionId}`, `Move "${s.title.slice(0, 40)}" to trash? You can restore it.`, 'Delete', () => k.act.deleteSession(s.path)))
      }
    }
    const old = olderThan(d.past, 30, d.now).length
    const pages = Math.ceil(d.past.length / max)
    rows.push(
      <Box flexDirection="row" gap={2} marginTop={k.isRich ? 1 : 0} alignItems="center">
        {old > 0 ? (
          <Box flexDirection="row" gap={1} alignItems="center">
            {k.tap('cleanup-old-icon', k.icon('calendar-x', C.redDeep, 13), () => k.act.askConfirm('cleanup'))}
            {Link(k, 'cleanup-old', `Clean up older than 30 days · ${old}`, () => k.act.askConfirm('cleanup'))}
          </Box>
        ) : null}
        <Box flexGrow={1} />
        {pages > 1 ? <Text dimColor>{`${page + 1} / ${pages}`}</Text> : null}
        {page > 0 ? Link(k, 'past-prev', '‹ Newer', () => k.act.setView({ pastPage: page - 1 })) : null}
        {page < pages - 1 ? Link(k, 'past-next', 'Older ›', () => k.act.setView({ pastPage: page + 1 })) : null}
      </Box>,
    )
    if (d.view.confirm === 'cleanup') {
      rows.push(Confirm(k, 'confirm-cleanup', `Move ${old} sessions older than 30 days to trash?`, 'Move', () => k.act.cleanupOld(30)))
    }
  }

  if (tab === 'trash') {
    if (d.trash.length === 0) rows.push(<Text dimColor>Trash is empty. Deleted sessions wait here until you empty it.</Text>)
    else rows.push(ColumnHeads(k, false, isWide))
    for (const t of d.trash.slice(0, max)) {
      rows.push(
        SessionLine(k, k.icon('trash', C.muted), [
          ...(isWide ? [Cell(k, COL.project, dim(t.project || '—'))] : []),
          Stretch(k, titled(t.project, t.title, true)),
          Cell(k, COL.when, dim(ago(d.now - t.deletedAt)), 'flex-end'),
          Cell(k, COL.action, Link(k, `restore-${t.trashedPath}`, 'Restore', () => k.act.restore(t.trashedPath), C.teal), 'flex-end'),
        ]),
      )
    }
    if (d.trash.length > 0) {
      rows.push(
        <Box flexDirection="row" gap={1} marginTop={k.isRich ? 1 : 0} alignItems="center">
          {k.tap('empty-trash-icon', k.icon('trash', C.redDeep, 13), () => k.act.askConfirm('empty'))}
          {Link(k, 'empty-trash', `Empty trash · ${fmtSize(d.trash.reduce((n, t) => n + t.size, 0))}`, () => k.act.askConfirm('empty'))}
        </Box>,
      )
    }
    if (d.view.confirm === 'empty') {
      rows.push(Confirm(k, 'confirm-empty', 'Permanently delete everything in trash? This cannot be undone.', 'Delete forever', () => k.act.emptyTrash()))
    }
  }

  return rows
}

// ── Compact gauges (for tight tiles) ───────────────────────────────────────

export function GaugeLines(k: Kit, d: Data): RenderNode[] {
  const { Button, Text } = k.el
  const gauges = gaugesOf(d.measure)
  if (gauges.length === 0) return [<Text dimColor>After the first reply</Text>]

  return gauges.map(g => {
    const color = levelColor(g.percent, g.calm)

    const note = gaugeNote(g, d.now)
    const about = () => k.act.aboutLimit(limitDetail(g, d.now))

    return Row(
      k,
      k.tap(`line-icon-${g.label}`, k.icon(g.icon, g.calm, 12), about),
      <Button key={`line-name-${g.label}`} plain onPress={about}>
        <Text dimColor wrap="truncate-end">{note ? `${g.label} · ${note.text}` : g.label}</Text>
      </Button>,
      <Button key={`line-figure-${g.label}`} plain onPress={about}>
        <Text color={color}>{`${bar(g.percent, 6)} ${Math.round(g.percent)}%`}</Text>
      </Button>,
    )
  })
}

// ── Glance: the band above the prompt ──────────────────────────────────────

// "4:30 pm (in 2h 10m)"; a reset already past reads "now".
export function resetText(resetsAt: string, now: number): string {
  const at = Date.parse(resetsAt)
  if (!Number.isFinite(at)) return 'soon'
  if (at <= now) return 'now'
  const day = new Date(at).toDateString() === new Date(now).toDateString() ? '' : ' tomorrow'

  return `${fmtTimeOfDay(at)}${day} (in ${fmtDuration(at - now)})`
}

// A pinned signal never shrinks or truncates; the others give way to it.
// `sub` draws as a second, dimmer line beneath `text`.
type Signal = { icon: IconName; color: string; text: string; sub?: string; strong?: boolean; pinned?: boolean }

// Only what matters right now, most urgent first: a limit about to bite,
// a failure, what is being worked on and when it ends, and who else is busy.
export function signals(d: Data): { list: Signal[]; wantsCompact: boolean } {
  const list: Signal[] = []
  const m = d.measure
  const ctx = m.context ?? 0
  // The 5h window leads, always, with the clock time it resets at.
  const fiveHour = m.limits.find(l => /five|5h/i.test(l.kind))
  if (fiveHour) {
    const isHigh = fiveHour.percent >= 70
    const sub = fiveHour.resetsAt ? `resets ${resetText(fiveHour.resetsAt, d.now)}` : 'reset time not reported yet'
    list.push({ icon: 'clock-hour-5', color: levelColor(fiveHour.percent, C.teal), text: `5h limit ${Math.round(fiveHour.percent)}%`, sub, strong: isHigh, pinned: true })
  }
  if (ctx >= 70) list.push({ icon: 'stack-2', color: levelColor(ctx, C.mission), text: `Context ${Math.round(ctx)}%`, strong: true })
  for (const l of m.limits) {
    if (l === fiveHour || l.percent < 70) continue
    const isWeek = /week|7d|seven/i.test(l.kind)
    const resets = l.resetsAt ? `, resets ${resetText(l.resetsAt, d.now)}` : ''
    list.push({ icon: isWeek ? 'calendar-week' : 'alert-triangle', color: levelColor(l.percent, C.teal), text: `${isWeek ? 'Weekly' : l.kind} limit ${Math.round(l.percent)}%${resets}`, strong: true })
  }
  const last = d.feed[d.feed.length - 1]
  if (last?.isError && last.endedAt !== undefined && d.now - last.endedAt < 10 * 60_000) {
    list.push({ icon: 'alert-triangle', color: C.red, text: `Failed: ${last.label}` })
  }

  const est = eta(d.todos, d.now, d.storedMedianMs)
  const current = d.todos.find(t => t.status === 'in_progress')
  if (current) {
    const left = est.leftMs !== undefined ? ` · ~${fmtDuration(est.leftMs)} left` : ''
    list.push({ icon: 'progress', color: C.mission, text: `${current.activeForm} · ${est.done + 1} of ${est.total}${left}` })
  } else if (d.turnStartedAt > 0) {
    list.push({ icon: 'progress', color: C.mission, text: `Working · ${fmtDuration(d.now - d.turnStartedAt)}` })
  } else if (est.total > 0 && est.done === est.total) {
    list.push({ icon: 'circle-check', color: C.teal, text: `All ${est.total} tasks done` })
  } else if (missionText(d).text) {
    list.push({ icon: 'target-arrow', color: C.mission, text: missionText(d).text })
  }

  const running = agentsRunning(d)
  if (running > 0) list.push({ icon: 'robot', color: C.blue, text: `${running} agent${running === 1 ? '' : 's'} working` })
  const busy = d.live.filter(s => !s.isHere && s.isBusy)
  if (busy.length === 1) list.push({ icon: 'world', color: C.coral, text: `${busy[0]?.name} busy` })
  else if (busy.length > 1) list.push({ icon: 'world', color: C.coral, text: `${busy.length} other sessions busy` })

  return { list, wantsCompact: ctx >= 70 }
}

export function Glance(k: Kit, d: Data, columns: number): RenderElement {
  const { Box, Text } = k.el
  k.cols = columns
  const { list, wantsCompact } = signals(d)
  const isOpen = d.view.glanceExpanded
  // Room decides how many signals show; the rest wait in the full view.
  const room = columns >= 150 ? 4 : columns >= 110 ? 3 : columns >= 80 ? 2 : 1
  const shown = list.slice(0, room)
  const hidden = list.length - shown.length

  const line = (
    <Box flexDirection="row" gap={2} alignItems="center" paddingX={1}>
      {k.tap('glance-spark', k.icon('sparkles', C.mission, 12), () => k.act.openFull())}
      {shown.length === 0 ? (
        <Text dimColor>All quiet</Text>
      ) : (
        shown.map(s => (
          <Box flexDirection="row" gap={1} alignItems="center" flexShrink={s.pinned ? 0 : 1} minWidth={s.pinned ? undefined : 0}>
            {k.tap(`glance-icon-${s.icon}`, k.icon(s.icon, s.color, 12), () => k.act.openFull())}
            <Box flexDirection="column" minWidth={0}>
              <Text wrap={s.pinned ? 'wrap' : 'truncate-end'} color={s.strong || s.pinned ? s.color : undefined}>
                {s.text}
              </Text>
              {s.sub ? <Text dimColor wrap="wrap">{s.sub}</Text> : null}
            </Box>
          </Box>
        ))
      )}
      {hidden > 0 && !isOpen ? <Text dimColor>{`+${hidden}`}</Text> : null}
      <Box flexGrow={1} />
      {wantsCompact ? Link(k, 'glance-compact', 'Compact', () => k.act.submit('/compact'), C.teal) : null}
      {Link(k, 'glance-more', isOpen ? 'Less ▴' : 'More ▾', () => k.act.setView({ glanceExpanded: !isOpen }), C.mission)}
      {Link(k, 'glance-open', 'Open', () => k.act.openFull())}
      {Link(k, 'glance-hide', '×', () => k.act.setGlance(false))}
    </Box>
  )
  if (!isOpen) return line

  // A little more, still above the prompt: the way to the mission on the
  // left, the latest few things done and the quick actions on the right.
  return (
    <Box flexDirection="column" gap={1}>
      {line}
      <Box flexDirection="row" gap={1}>
        <Box flexDirection="column" borderStyle="round" borderColor={C.mission} paddingX={1} flexGrow={3} flexShrink={1} width={0} minWidth={0}>
          {MissionBody(k, d, 0)}
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} flexGrow={2} flexShrink={1} width={0} minWidth={0}>
          {ActivityBody(k, d, 3)}
          <Box height={1} />
          {ActionsBody(k, d)}
        </Box>
      </Box>
    </Box>
  )
}
