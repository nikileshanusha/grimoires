import { ICONS } from './icons'
import type { IconName } from './icons'

// One hue per category, mid-ramp so each reads on light and dark alike.
export const C = {
  mission: '#7F77DD',
  indigo: '#534AB7',
  teal: '#1D9E75',
  blue: '#378ADD',
  coral: '#D85A30',
  pink: '#D4537E',
  amber: '#BA7517',
  green: '#639922',
  red: '#E24B4A',
  redDeep: '#A32D2D',
  muted: '#888780',
  track: '#88878033',
} as const

// Soft chip pairs: a 50-stop background with its ramp's 800-stop text.
export const CHIP = {
  violet: { bg: '#EEEDFE', fg: '#3C3489' },
  coral: { bg: '#FAECE7', fg: '#712B13' },
  teal: { bg: '#E1F5EE', fg: '#085041' },
  amber: { bg: '#FAEEDA', fg: '#633806' },
  red: { bg: '#FCEBEB', fg: '#791F1F' },
  blue: { bg: '#E6F1FB', fg: '#0C447C' },
} as const
export type ChipTone = keyof typeof CHIP

// Gauges turn amber past 70% and red past 90%; calm otherwise.
export function levelColor(percent: number, calm: string): string {
  if (percent >= 90) return C.red
  if (percent >= 70) return C.amber

  return calm
}

export function iconSvg(name: IconName, color: string, size = 14): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">` +
    `${ICONS[name]}</svg>`
  )
}

export function ringSvg(percent: number, color: string, size = 52): string {
  const r = 22
  const circumference = 2 * Math.PI * r
  const shown = Math.min(100, Math.max(0, percent))
  const offset = circumference * (1 - shown / 100)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56">` +
    `<circle cx="28" cy="28" r="${r}" fill="none" stroke="${C.track}" stroke-width="5"/>` +
    `<circle cx="28" cy="28" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" ` +
    `stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 28 28)"/>` +
    `<text x="28" y="32.5" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="${color}">` +
    `${Math.round(percent)}%</text></svg>`
  )
}

export type Segment = 'done' | 'current' | 'pending'

export function segmentsSvg(states: readonly Segment[], width = 420): string {
  const n = Math.max(1, states.length)
  const gap = 4
  const w = (width - gap * (n - 1)) / n
  const fill = (s: Segment) => (s === 'done' ? C.teal : s === 'current' ? C.mission : C.track)
  const bars = states
    .map((s, i) => `<rect x="${(i * (w + gap)).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="5" rx="2.5" fill="${fill(s)}"/>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="5" viewBox="0 0 ${width} 5" preserveAspectRatio="none">${bars}</svg>`
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The path to the mission: done steps in teal, the current one softly filled
// in violet, what's next outlined and dashed, joined by quiet arrows.
// Transparent fills keep it right on light and dark alike.
export function flowSvg(steps: readonly { label: string; status: 'done' | 'now' | 'next' }[], before: number, after: number): string {
  const H = 40
  const font = 15
  const charW = 8.2
  const arrow = 28
  type Node = { text: string; w: number; kind: 'done' | 'now' | 'next' | 'more' }
  const nodes: Node[] = []
  const short = (s: string) => (s.length > 30 ? `${s.slice(0, 29)}…` : s)
  if (before > 0) nodes.push({ text: `${before} done`, w: 0, kind: 'more' })
  for (const s of steps) nodes.push({ text: (s.status === 'done' ? '✓ ' : '') + short(s.label), w: 0, kind: s.status })
  if (after > 0) nodes.push({ text: `+${after} more`, w: 0, kind: 'more' })
  for (const n of nodes) n.w = Math.round(n.text.length * charW + 32)

  let x = 1
  const parts: string[] = []
  nodes.forEach((n, i) => {
    const style =
      n.kind === 'done'
        ? `fill="none" stroke="${C.teal}" stroke-width="1.25"`
        : n.kind === 'now'
          ? `fill="${C.mission}2E" stroke="${C.mission}" stroke-width="1.75"`
          : n.kind === 'next'
            ? `fill="none" stroke="${C.muted}" stroke-width="1.1" stroke-dasharray="4 3"`
            : `fill="none" stroke="none"`
    const color = n.kind === 'done' ? C.teal : n.kind === 'now' ? C.mission : C.muted
    parts.push(`<rect x="${x}" y="1" width="${n.w}" height="${H}" rx="${H / 2}" ${style}/>`)
    parts.push(
      `<text x="${x + n.w / 2}" y="${H / 2 + 6}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${font}" ` +
        `font-weight="${n.kind === 'now' ? 600 : 400}" fill="${color}">${escapeXml(n.text)}</text>`,
    )
    x += n.w
    if (i < nodes.length - 1) {
      const y = H / 2 + 1
      parts.push(`<path d="M${x + 6} ${y}h${arrow - 12}m-5 -5l5 5l-5 5" fill="none" stroke="${C.muted}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`)
      x += arrow
    }
  })
  const width = Math.ceil(x + 1)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H + 2}" viewBox="0 0 ${width} ${H + 2}">${parts.join('')}</svg>`
}

export type MetroStep = { label: string; status: 'done' | 'now' | 'next'; meta?: string }

// The way to the mission as a vertical metro line: stops for each step, the
// line teal up to where we are and dashed after it, the current stop
// haloed in violet. Narrow and fixed in width, so the surface never shrinks
// it: its text draws at full size.
export function metroSvg(steps: readonly MetroStep[], before: number, after: number, width = 440): string {
  const row = 34
  const top = before > 0 ? 26 : 10
  const height = top + steps.length * row + (after > 0 ? 22 : 0) - 6
  const cx = 16
  const labelX = 40
  const font = 'font-family="system-ui, -apple-system, Segoe UI, sans-serif"'
  const maxChars = Math.floor((width - labelX - 90) / 7.6)
  const fit = (s: string) => (s.length > maxChars ? `${s.slice(0, maxChars - 1)}…` : s)
  const y = (i: number) => top + i * row + 8
  const nowAt = steps.findIndex(s => s.status === 'now')
  const doneUntil = nowAt >= 0 ? nowAt : steps.filter(s => s.status === 'done').length - 1
  const parts: string[] = []

  if (before > 0) {
    parts.push(`<line x1="${cx}" y1="2" x2="${cx}" y2="${y(0)}" stroke="${C.teal}" stroke-width="2.5" stroke-linecap="round"/>`)
    parts.push(`<text x="${labelX}" y="15" ${font} font-size="12" fill="${C.muted}">${before} earlier step${before === 1 ? '' : 's'} done</text>`)
  }
  for (let i = 0; i < steps.length - 1; i++) {
    const isDoneLeg = i < doneUntil
    parts.push(
      `<line x1="${cx}" y1="${y(i)}" x2="${cx}" y2="${y(i + 1)}" stroke="${isDoneLeg ? C.teal : C.muted}" stroke-width="${isDoneLeg ? 2.5 : 1.5}" ` +
        `${isDoneLeg ? '' : 'stroke-dasharray="3 4"'} stroke-linecap="round"/>`,
    )
  }
  if (after > 0) {
    const last = y(steps.length - 1)
    parts.push(`<line x1="${cx}" y1="${last}" x2="${cx}" y2="${last + 18}" stroke="${C.muted}" stroke-width="1.5" stroke-dasharray="3 4"/>`)
    parts.push(`<text x="${labelX}" y="${last + 22}" ${font} font-size="12" fill="${C.muted}">+${after} more step${after === 1 ? '' : 's'}</text>`)
  }
  steps.forEach((s, i) => {
    const cy = y(i)
    if (s.status === 'done') {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="8" fill="${C.teal}"/>`)
      parts.push(`<path d="M${cx - 3.5} ${cy}l2.5 2.5l4.5 -5" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`)
    } else if (s.status === 'now') {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="14" fill="${C.mission}33"/>`)
      parts.push(`<circle cx="${cx}" cy="${cy}" r="8.5" fill="none" stroke="${C.mission}" stroke-width="2.5"/>`)
      parts.push(`<circle cx="${cx}" cy="${cy}" r="3.5" fill="${C.mission}"/>`)
    } else {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="6.5" fill="none" stroke="${C.muted}" stroke-width="1.5"/>`)
    }
    const color = s.status === 'done' ? C.teal : s.status === 'now' ? C.mission : C.muted
    const weight = s.status === 'now' ? 600 : 400
    const size = s.status === 'now' ? 15 : 14
    parts.push(`<text x="${labelX}" y="${cy + 5}" ${font} font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(fit(s.label))}</text>`)
    if (s.meta) parts.push(`<text x="${width - 4}" y="${cy + 4}" ${font} font-size="12" text-anchor="end" fill="${C.muted}">${escapeXml(s.meta)}</text>`)
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`
}

// The mission card's one strong accent: a thin violet edge.
export function edgeSvg(height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="${height}"><rect width="3" height="${height}" rx="1.5" fill="${C.mission}"/></svg>`
}

// The terminal has no Svg: these glyphs stand in, in the same colors.
export const GLYPH: Partial<Record<IconName, string>> = {
  'target-arrow': '◎',
  hourglass: '⧗',
  'stack-2': '≡',
  'clock-hour-5': '◷',
  'calendar-week': '▦',
  'list-check': '☰',
  progress: '◐',
  'circle-check': '✓',
  'circle-dashed': '○',
  robot: '⚙',
  binoculars: '⌕',
  flask: '⚗',
  compass: '✧',
  feather: '✎',
  send: '➤',
  world: '◍',
  'terminal-2': '›',
  'brand-vscode': '◇',
  'device-desktop': '▭',
  activity: '∿',
  pencil: '✎',
  terminal: '$',
  'file-search': '⌕',
  notes: '✐',
  bolt: 'ϟ',
  'file-text': '¶',
  'eye-check': '◉',
  'arrows-minimize': '⇲',
  eraser: '⌫',
  trash: '⌧',
  history: '↺',
  'arrow-back-up': '↶',
  'calendar-x': '⊠',
  'layout-rows': '☰',
  'layout-columns': '⫼',
  'layout-kanban': '▥',
  'layout-sidebar-right': '◧',
  point: '·',
  check: '✓',
  x: '×',
  plus: '+',
  'alert-triangle': '△',
  tool: '⚒',
  sparkles: '✦',
  gauge: '◔',
}

export function bar(percent: number, cells: number): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * cells)

  return '━'.repeat(filled) + '─'.repeat(cells - filled)
}
