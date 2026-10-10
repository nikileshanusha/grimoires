import type { RenderElement, RenderNode } from 'claude-code'

import type { DrawerTab, Layout } from '../types'
import {
  ActionsBody,
  ActivityBody,
  AgentsBody,
  BarNode,
  Card,
  Gap,
  GaugesBody,
  GoalNode,
  Header,
  MissionCard,
  NotesBody,
  SessionsBody,
  SessionsTabs,
  TaskRows,
  NoteComposer,
  IconCell,
  MetaCell,
  NowNextNode,
  GaugeLines,
  agentsRunning,
  countsText,
  etaText,
} from './cards'
import type { Data, Kit } from './cards'
import type { IconName } from './icons'
import { C } from './visuals'

export const LAYOUTS: { id: Layout; label: string; icon: IconName; minColumns: number }[] = [
  { id: 'rows', label: 'Rows', icon: 'layout-rows', minColumns: 90 },
  { id: 'columns', label: 'Columns', icon: 'layout-columns', minColumns: 110 },
  { id: 'strip', label: 'Strip', icon: 'layout-kanban', minColumns: 90 },
  { id: 'focus', label: 'Focus', icon: 'layout-sidebar-right', minColumns: 90 },
]

// What actually draws: the saved choice when it fits, else the next roomier
// fallback, else one stacked column. The saved choice is never changed here.
export function fitLayout(chosen: Layout, columns: number): Layout | 'stacked' {
  const order: Layout[] = chosen === 'columns' ? ['columns', 'rows'] : [chosen]
  for (const id of order) {
    const spec = LAYOUTS.find(l => l.id === id)
    if (spec && columns >= spec.minColumns) return id
  }

  return 'stacked'
}

function TopBar(k: Kit, d: Data): RenderNode {
  const { Box, Button, Text } = k.el
  const running = agentsRunning(d)
  const others = d.live.filter(s => !s.isHere)
  const busy = others.filter(s => s.isBusy).length
  const summary = [
    running > 0 ? `${running} agent${running === 1 ? '' : 's'} working` : undefined,
    others.length > 0 ? `${others.length} other session${others.length === 1 ? '' : 's'}${busy > 0 ? `, ${busy} busy` : ''}` : undefined,
  ].filter(Boolean)

  return (
    <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2} paddingX={1}>
      {k.icon('sparkles', C.mission, 13)}
      <Text dimColor>{summary.length > 0 ? summary.join(' · ') : 'All quiet'}</Text>
      <Box flexGrow={1} />
      <Box flexDirection="row" gap={1} alignItems="center">
        {k.icon('sparkles', d.view.glance ? C.mission : C.muted, 13)}
        <Button key="glance-toggle" plain onPress={() => k.act.setGlance(!d.view.glance)}>
          <Text dimColor>{d.view.glance ? 'Glance above prompt: on' : 'Glance above prompt: off'}</Text>
        </Button>
      </Box>
      <Text dimColor>│</Text>
      {LAYOUTS.map(l => {
        const isOn = d.view.layout === l.id

        return (
          <Box flexDirection="row" gap={1} alignItems="center">
            {k.icon(l.icon, isOn ? C.mission : C.muted, 13)}
            <Button key={`layout-${l.id}`} plain onPress={() => k.act.setView({ layout: l.id })}>
              <Text color={isOn ? C.mission : undefined} dimColor={!isOn}>
                {l.label}
              </Text>
            </Button>
          </Box>
        )
      })}
    </Box>
  )
}

const ActivityCard = (k: Kit, d: Data, max: number, width?: string) =>
  Card(k, { icon: 'activity', color: C.teal, title: 'Activity', width, right: <k.el.Text dimColor>{countsText(d.counts)}</k.el.Text> }, ActivityBody(k, d, max))

const AgentsCard = (k: Kit, d: Data, max: number, width?: string) =>
  Card(
    k,
    { icon: 'robot', color: C.blue, title: 'Agents', width, right: <k.el.Text dimColor>{`${agentsRunning(d)} running`}</k.el.Text> },
    AgentsBody(k, d, max),
  )

// `share` is the part of the pane's width the card gets, so its columns fit.
const SessionsCard = (k: Kit, d: Data, max: number, width?: string, share = 1) =>
  Card(k, { icon: 'world', color: C.coral, title: 'Sessions', width, right: SessionsTabs(k, d) }, SessionsBody(k, d, max, Math.floor(k.cols * share) - 4))

const NotesCard = (k: Kit, d: Data, max: number, width?: string) =>
  Card(k, { icon: 'notes', color: C.pink, title: 'Notes', width, right: <k.el.Text dimColor>{`${d.notes.length}`}</k.el.Text> }, NotesBody(k, d, max))

// A · Two rows: focus on top (mission | limits, actions, notes), motion below.
function Rows(k: Kit, d: Data): RenderNode {
  const { Box } = k.el

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" gap={1}>
        {MissionCard(k, d, 5, '62%')}
        <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} paddingY={k.isRich ? 1 : 0} flexGrow={38} flexShrink={1} width={0} minWidth={0}>
          {GaugesBody(k, d)}
          {Gap(k)}
          {ActionsBody(k, d)}
          {Gap(k)}
          {Header(k, 'notes', C.pink, 'Notes', <k.el.Text dimColor>{`${d.notes.length}`}</k.el.Text>)}
          {NotesBody(k, d, 2)}
        </Box>
      </Box>
      <Box flexDirection="row" gap={1}>
        {ActivityCard(k, d, 5, '34%')}
        {AgentsCard(k, d, 4, '33%')}
        {SessionsCard(k, d, 4, '33%', 0.33)}
      </Box>
    </Box>
  )
}

// B · Three columns: a thin bar of controls, then me | work | elsewhere.
function Columns(k: Kit, d: Data): RenderNode {
  const { Box } = k.el

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" gap={2} alignItems="center" borderStyle="round" borderColor="subtle" paddingX={1}>
        <Box flexDirection="row" gap={2}>
          {GaugesBody(k, d, true)}
        </Box>
        <Box flexGrow={1} />
        {ActionsBody(k, d)}
      </Box>
      <Box flexDirection="row" gap={1}>
        {MissionCard(k, d, 8, '40%')}
        <Box flexDirection="column" gap={1} flexGrow={30} flexShrink={1} width={0} minWidth={0}>
          {ActivityCard(k, d, 6)}
          {NotesCard(k, d, 3)}
        </Box>
        <Box flexDirection="column" gap={1} flexGrow={30} flexShrink={1} width={0} minWidth={0}>
          {AgentsCard(k, d, 4)}
          {SessionsCard(k, d, 4, undefined, 0.3)}
        </Box>
      </Box>
    </Box>
  )
}

// C · Strip: one low row of tiles, made to sit above the prompt.
function Strip(k: Kit, d: Data): RenderNode {
  const { Box, Text } = k.el
  const right = etaText(d)
  const current = d.todos.find(t => t.status === 'in_progress')
  const lastFeed = d.feed[d.feed.length - 1]
  const latestAgent = d.agents.find(a => a.endedAt === undefined) ?? d.agents[0]
  const others = d.live.filter(s => !s.isHere)
  const busy = others.filter(s => s.isBusy)

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" gap={1}>
        {Card(
          k,
          {
            icon: 'target-arrow',
            color: C.mission,
            title: 'Mission',
            accent: true,
            width: '36%',
            right: right ? (
              <Box flexDirection="row" gap={1} alignItems="center">
                {k.icon('hourglass', C.mission, 12)}
                <Text dimColor>{right}</Text>
              </Box>
            ) : undefined,
          },
          [
            GoalNode(k, d),
            ...(NowNextNode(k, d).length > 0 ? NowNextNode(k, d) : [<Text dimColor>{current ? current.activeForm : 'No tasks yet'}</Text>]),
          ],
        )}
        {Card(k, { icon: 'gauge', color: C.teal, title: 'Limits', width: '20%' }, GaugeLines(k, d))}
        {Card(k, { icon: 'activity', color: C.teal, title: 'Work', width: '22%', right: <Text dimColor>{`${agentsRunning(d)} agents`}</Text> }, [
          <Text dimColor wrap="truncate-end">{countsText(d.counts)}</Text>,
          <Box flexDirection="row" gap={1} alignItems="center">
            {k.icon('robot', C.blue, 12)}
            <Text wrap="truncate-end" dimColor={!latestAgent || latestAgent.endedAt !== undefined}>
              {latestAgent ? latestAgent.description : lastFeed ? `${lastFeed.verb}${lastFeed.label ? ` ${lastFeed.label}` : ''}` : 'Quiet so far'}
            </Text>
          </Box>,
        ])}
        {Card(k, { icon: 'world', color: C.coral, title: 'Elsewhere', width: '22%', right: <Text dimColor>{`${others.length} live`}</Text> }, [
          ...(busy.length > 0 ? busy : others).slice(0, 2).map(s => (
            <Box flexDirection="row" gap={1} alignItems="center">
              {IconCell(
                k,
                k.icon(s.entry === 'ide' ? 'brand-vscode' : s.entry === 'desktop' ? 'device-desktop' : 'terminal-2', s.entry === 'ide' ? C.pink : s.entry === 'desktop' ? C.blue : C.coral, 12),
              )}
              <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                <Text wrap="truncate-end">{s.name}</Text>
              </Box>
              {MetaCell(k, s.isBusy ? k.chip('busy', 'coral') : k.chip('idle', 'quiet'), 8)}
            </Box>
          )),
          ...(others.length === 0 ? [<Text dimColor>No other sessions</Text>] : []),
        ])}
      </Box>
      {ActionsBody(k, d)}
      {NoteComposer(k, d)}
    </Box>
  )
}

const DRAWER: { id: DrawerTab; label: string; icon: IconName; color: string }[] = [
  { id: 'activity', label: 'Activity', icon: 'activity', color: C.teal },
  { id: 'agents', label: 'Agents', icon: 'robot', color: C.blue },
  { id: 'sessions', label: 'Sessions', icon: 'world', color: C.coral },
  { id: 'notes', label: 'Notes', icon: 'notes', color: C.pink },
]

function drawerCount(d: Data, tab: DrawerTab): number {
  if (tab === 'activity') return d.feed.length
  if (tab === 'agents') return agentsRunning(d)
  if (tab === 'sessions') return d.live.length

  return d.notes.length
}

// D · Focus and drawer: the mission dominates; the rest wait behind tabs.
function Focus(k: Kit, d: Data): RenderNode {
  const { Box, Button, Text } = k.el
  const tab = d.view.drawerTab
  const body =
    tab === 'activity'
      ? ActivityBody(k, d, 8)
      : tab === 'agents'
        ? AgentsBody(k, d, 6)
        : tab === 'sessions'
          ? [<Box marginBottom={k.isRich ? 1 : 0}>{SessionsTabs(k, d)}</Box>, ...SessionsBody(k, d, 6, Math.floor(k.cols * 0.37) - 4)]
          : NotesBody(k, d, 6)

  return (
    <Box flexDirection="row" gap={1}>
      <Box flexDirection="column" flexGrow={63} flexShrink={1} width={0} minWidth={0}>
        {MissionCard(k, d, 9)}
        <Box flexDirection="row" gap={2} alignItems="center" paddingX={1} marginTop={k.isRich ? 1 : 0}>
          <Box flexDirection="row" gap={2}>
            {GaugesBody(k, d, true)}
          </Box>
          <Box flexGrow={1} />
          {ActionsBody(k, d)}
        </Box>
      </Box>
      <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} paddingY={k.isRich ? 1 : 0} flexGrow={37} flexShrink={1} width={0} minWidth={0}>
        <Box flexDirection="row" gap={2} marginBottom={k.isRich ? 1 : 0} flexWrap="wrap">
          {DRAWER.map(t => {
            const isOn = t.id === tab

            return (
              <Box flexDirection="row" gap={1} alignItems="center">
                {k.icon(t.icon, isOn ? t.color : C.muted, 15)}
                <Button key={`drawer-${t.id}`} plain onPress={() => k.act.setView({ drawerTab: t.id, confirm: undefined })}>
                  <Text color={isOn ? t.color : undefined} dimColor={!isOn} bold={isOn}>
                    {t.label}
                  </Text>
                  <Text dimColor>{` ${drawerCount(d, t.id)}`}</Text>
                </Button>
              </Box>
            )
          })}
        </Box>
        {body}
      </Box>
    </Box>
  )
}

function Stacked(k: Kit, d: Data): RenderNode {
  const { Box } = k.el

  return (
    <Box flexDirection="column" gap={1}>
      {MissionCard(k, d, 5)}
      <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
        {GaugesBody(k, d, true)}
        {Gap(k)}
        {ActionsBody(k, d)}
      </Box>
      {ActivityCard(k, d, 4)}
      {AgentsCard(k, d, 3)}
      {SessionsCard(k, d, 3)}
      {NotesCard(k, d, 2)}
    </Box>
  )
}

export function Pane(k: Kit, d: Data, columns: number): RenderElement {
  const { Box } = k.el
  k.cols = columns
  const shape = fitLayout(d.view.layout, columns)
  const body =
    shape === 'rows' ? Rows(k, d) : shape === 'columns' ? Columns(k, d) : shape === 'strip' ? Strip(k, d) : shape === 'focus' ? Focus(k, d) : Stacked(k, d)

  return (
    <Box flexDirection="column" gap={1}>
      {TopBar(k, d)}
      {body}
    </Box>
  )
}
