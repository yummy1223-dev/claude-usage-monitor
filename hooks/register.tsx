import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit, Snapshot } from '../types'

const BAR = 8
const LABELS: Record<string, string> = { five_hour: '5H', seven_day: '7D', spend_limit: 'SPEND' }

// Muted tones, readable on dark and light themes without glare.
const C = {
  ok: '#7fae8c',
  warn: '#cfae6e',
  hot: '#cc7f7f',
  empty: '#5b6270',
  label: '#8b97aa',
  sep: '#4d5461',
  cost: '#a3aed0',
}

const snap = atom({ plugin: 'usage-monitor', key: 'snap' } as const, null, {
  shape: 'snap-1',
})
const isHidden = atom({ plugin: 'usage-monitor', key: 'isHidden' } as const, false)

type Figures = {
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]
  cost?: { usd: number }
}

async function store($: EngineInterface, f: Figures) {
  const next: Snapshot = {
    ctxPercent: f.context.percent,
    ctxTokens: f.context.tokens,
    ctxWindow: f.context.window,
    limits: f.rateLimits.map(l => ({ kind: l.kind, percent: l.percentUsed, resetsAt: l.resetsAt })),
    usd: f.cost?.usd,
    at: await $.clock.now(),
  }
  await update($, snap, () => next)
}

async function refresh($: EngineInterface) {
  await store($, await $.session.usage())
}

const tone = (p: number) => (p >= 85 ? C.hot : p >= 60 ? C.warn : C.ok)

const kTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

function countdown(resetsAt: string | undefined, now: number) {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - now
  if (!(ms > 0)) return 'reset'
  const m = Math.floor(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d > 0 ? `${d}d${String(h).padStart(2, '0')}h` : `${h}h${String(m % 60).padStart(2, '0')}m`
}

type Seg = { label: string; percent?: number; detail: string }

// label + space + bar + space + "100%" + detail
const segWidth = (s: Seg) => s.label.length + 1 + BAR + 1 + 4 + (s.detail ? s.detail.length + 1 : 0)

export const register: Register = on => {
  let tick: { cancel: () => void } | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'usage-monitor', description: 'Show or hide the usage line' })
    await refresh($)
    tick?.cancel()
    // Keeps the reset countdowns moving between measurements.
    tick = $.clock.every(30_000, () => void refresh($))

    return next(e)
  })

  on('command.run', { command: 'usage-monitor' }, async $ => {
    const hidden = await update($, isHidden, v => !v)
    await refresh($)

    return { text: hidden ? 'Usage line hidden.' : 'Usage line shown.' }
  })

  on('session.measure', async ($, e, next) => {
    await store($, e)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, snap)
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    if (!s) {
      return <Text mono color={C.empty}>{'▸ usage: awaiting telemetry_'}</Text>
    }

    const segs: Seg[] = [
      {
        label: 'CTX',
        percent: s.ctxPercent,
        detail: `${s.ctxTokens === undefined ? '--' : kTokens(s.ctxTokens)}/${kTokens(s.ctxWindow)}`,
      },
      ...s.limits.map((l: Limit) => {
        const left = countdown(l.resetsAt, s.at)
        return { label: LABELS[l.kind] ?? l.kind.toUpperCase().slice(0, 5), percent: l.percent, detail: left && `↻${left}` }
      }),
    ]
    const cost = s.usd === undefined ? '$--' : `$${s.usd.toFixed(2)}`

    const seg = (g: Seg) => {
      const p = g.percent ?? 0
      const used = Math.round((Math.min(100, Math.max(0, p)) / 100) * BAR)
      const color = g.percent === undefined ? C.empty : tone(p)
      return [
        <Text mono bold color={C.label}>{g.label} </Text>,
        <Text mono color={color}>{'▰'.repeat(used)}</Text>,
        <Text mono color={C.empty}>{'▱'.repeat(BAR - used)}</Text>,
        <Text mono tabular bold color={color}>{(g.percent === undefined ? '--' : `${Math.round(p)}%`).padStart(5)}</Text>,
        g.detail ? <Text mono tabular color={C.label}> {g.detail}</Text> : null,
      ]
    }
    const sep = <Text mono color={C.sep}>{'  │  '}</Text>
    const costSeg = <Text mono tabular bold color={C.cost}>{cost}</Text>

    const line = (items: Seg[], withCost: boolean) => (
      <Box>
        {items.flatMap((g, i) => (i === 0 ? seg(g) : [sep, ...seg(g)]))}
        {withCost && [items.length ? sep : null, costSeg]}
      </Box>
    )

    const full = segs.reduce((w, g) => w + segWidth(g) + 5, cost.length)
    if (full <= e.props.bodyColumns || segs.length < 2) {
      return line(segs, true)
    }

    // Too narrow for one row: context and cost first, rate limits under them.
    return (
      <Box flexDirection="column">
        {line(segs.slice(0, 1), true)}
        {line(segs.slice(1), false)}
      </Box>
    )
  })
}
