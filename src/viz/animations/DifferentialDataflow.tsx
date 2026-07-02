import React from 'react'
import type * as d3 from 'd3'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { font, ink, palette } from '../core/theme'
import { caption, clamp01, lerp, mathLabel, stagger, type G } from '../core/draw'

// Differential dataflow in one picture: a pipeline counting page views.
// Batch recomputes the world for every change; differential sends (data,
// time, diff) deltas — including a retraction — and the frontier decides when
// an output is safe to commit. Work is proportional to change, not data size.

const BASE: string[] = ['/a', '/b', '/a', '/c', '/a', '/b']
const KEYS = ['/a', '/b', '/c']

// act-4 deltas: (key, diff, timestamp) — includes a retraction
const DELTAS: { key: string; diff: 1 | -1; t: number }[] = [
  { key: '/a', diff: 1, t: 4 },
  { key: '/c', diff: 1, t: 5 },
  { key: '/a', diff: -1, t: 6 },
]

const ACTS: Act[] = [
  {
    name: 'a dataflow',
    duration: 3800,
    hold: 400,
    say: 'Think of the computation as a pipeline. Records flow in on the left, through operators, and a result — page views per URL — collects on the right.',
  },
  {
    name: 'the batch way',
    duration: 3800,
    hold: 500,
    say: 'Now one new record arrives. The traditional answer: throw the result away and recompute everything. Every record flows again. All ten thousand of them — for one change.',
  },
  {
    name: 'differences, not snapshots',
    duration: 3400,
    hold: 500,
    say: 'Differential dataflow refuses. It represents the collection as changes: this record, plus one. Only the difference flows, and the count just… adjusts. Work done: one record.',
  },
  {
    name: 'timestamps and the frontier',
    duration: 5200,
    hold: 600,
    say: 'But with changes streaming in — including retractions, like minus one — when is an answer safe to show? Every change carries a timestamp, and the frontier is the system’s proof that no earlier input can still arrive. Outputs commit exactly when the frontier passes them.',
  },
  {
    name: 'why it scales',
    duration: 2800,
    hold: 1000,
    say: 'And that is the whole trade. Batch does work proportional to your data. Differential does work proportional to your change. When the data is huge and the change is tiny, it is not a little faster — it is a different sport.',
  },
]

const CAPTIONS: Record<string, string> = {
  'a dataflow': 'records → operators → a live result',
  'the batch way': 'one new record ⇒ recompute the world',
  'differences, not snapshots': 'ship (data, time, +1) — not the whole collection',
  'timestamps and the frontier': 'the frontier = proof that no earlier input remains',
  'why it scales': 'work ∝ size of the CHANGE, not size of the data',
}

const chipColor = (diff: 1 | -1 | 0) => (diff === 1 ? palette.green : diff === -1 ? palette.pink : palette.blue)

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  void defs
  const root = svg.append('g') as G

  const IN_X = 120
  const OP1 = { x: 350, y: 240 }
  const OP2 = { x: 560, y: 240 }
  const OUT_X = 790
  const rowY = (k: string) => 180 + KEYS.indexOf(k) * 56

  // operators
  for (const [op, label, sub] of [
    [OP1, 'map', 'event → url'],
    [OP2, 'count', 'by url'],
  ] as const) {
    root
      .append('rect')
      .attr('x', op.x - 56)
      .attr('y', op.y - 34)
      .attr('width', 112)
      .attr('height', 68)
      .attr('rx', 12)
      .attr('fill', '#141a29')
      .attr('stroke', palette.teal)
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', 1.5)
    mathLabel(root, { x: op.x, y: op.y - 2, text: label, color: palette.teal, size: 19, italic: false })
    mathLabel(root, { x: op.x, y: op.y + 18, text: sub, color: ink.muted, size: 12, italic: false })
  }
  // wiring
  for (const [x1, x2] of [
    [IN_X + 30, OP1.x - 56],
    [OP1.x + 56, OP2.x - 56],
  ] as const) {
    root.append('line').attr('x1', x1).attr('x2', x2).attr('y1', 240).attr('y2', 240).attr('stroke', ink.axis)
  }
  root.append('line').attr('x1', OP2.x + 56).attr('x2', OUT_X - 58).attr('y1', 240).attr('y2', 240).attr('stroke', ink.axis)

  mathLabel(root, { x: IN_X, y: 96, text: 'input events', color: ink.secondary, size: 14, italic: false })
  mathLabel(root, { x: OUT_X + 10, y: 130, text: 'views per url', color: ink.secondary, size: 14, italic: false })

  // output table
  const counts = new Map<string, ReturnType<typeof mathLabel>>()
  const rowFlash = new Map<string, d3.Selection<SVGRectElement, unknown, null, undefined>>()
  for (const k of KEYS) {
    const y = rowY(k)
    const flash = root
      .append('rect')
      .attr('x', OUT_X - 58)
      .attr('y', y - 20)
      .attr('width', 150)
      .attr('height', 40)
      .attr('rx', 8)
      .attr('fill', palette.yellow)
      .attr('opacity', 0)
    root
      .append('rect')
      .attr('x', OUT_X - 58)
      .attr('y', y - 20)
      .attr('width', 150)
      .attr('height', 40)
      .attr('rx', 8)
      .attr('fill', 'none')
      .attr('stroke', ink.axis)
    mathLabel(root, { x: OUT_X - 30, y: y + 6, text: k, color: ink.primary, size: 16, mono: true })
    counts.set(k, mathLabel(root, { x: OUT_X + 60, y: y + 6, text: '0', color: palette.yellow, size: 18, mono: true }))
    rowFlash.set(k, flash)
  }

  // record chips (base + the act-2 addition + the act-4 deltas)
  const mkChip = (label: string, diff: 1 | -1 | 0, sub?: string) => {
    const g = root.append('g').attr('opacity', 0) as G
    const w = 30 + label.length * 7 + (diff !== 0 ? 22 : 0)
    g.append('rect')
      .attr('x', -w / 2)
      .attr('y', -11)
      .attr('width', w)
      .attr('height', 22)
      .attr('rx', 11)
      .attr('fill', '#141a29')
      .attr('stroke', chipColor(diff))
      .attr('stroke-width', 1.4)
    g.append('text')
      .attr('x', 0)
      .attr('y', 4.5)
      .attr('text-anchor', 'middle')
      .attr('fill', chipColor(diff))
      .attr('font-size', 12.5)
      .attr('font-family', font.mono)
      .text(diff === 0 ? label : `${label} ${diff > 0 ? '+1' : '−1'}`)
    if (sub) {
      g.append('text')
        .attr('x', 0)
        .attr('y', -16)
        .attr('text-anchor', 'middle')
        .attr('fill', palette.gold)
        .attr('font-size', 11)
        .attr('font-family', font.mono)
        .text(sub)
    }
    return g
  }
  const baseChips = BASE.map((k) => mkChip(k, 0))
  const newChipBatch = mkChip('/b', 0)
  const deltaChip = mkChip('/b', 1)
  const tsChips = DELTAS.map((d) => mkChip(d.key, d.diff, `t=${d.t}`))

  // work counters
  const batchWork = mathLabel(root, { x: 250, y: 460, text: '', color: palette.red, size: 17, mono: true })
  const diffWork = mathLabel(root, { x: 640, y: 460, text: '', color: palette.green, size: 17, mono: true })

  // frontier timeline (act 4)
  const FT = { x0: 300, x1: 660, y: 400 }
  const frontierAxis = root
    .append('line')
    .attr('x1', FT.x0)
    .attr('x2', FT.x1)
    .attr('y1', FT.y)
    .attr('y2', FT.y)
    .attr('stroke', ink.axis)
    .attr('opacity', 0)
  const ftX = (t: number) => FT.x0 + ((t - 3.5) / 3) * (FT.x1 - FT.x0)
  const tickLabs = DELTAS.map((d) =>
    mathLabel(root, { x: ftX(d.t), y: FT.y + 22, text: `t=${d.t}`, color: ink.secondary, size: 13, mono: true }),
  )
  const frontierLine = root
    .append('line')
    .attr('y1', FT.y - 26)
    .attr('y2', FT.y + 8)
    .attr('stroke', palette.gold)
    .attr('stroke-width', 2.5)
    .attr('opacity', 0)
  const frontierLab = mathLabel(root, { x: 0, y: FT.y - 36, text: 'frontier', color: palette.gold, size: 14 })
  frontierLab.attr('opacity', 0)

  const cap = caption(root, { x: width / 2, y: height - 16, text: '', size: 15 })

  // chip trajectory: input stack → op1 → op2 → its output row
  const flyChip = (g: G, k: string, t: number, stackIdx: number) => {
    const startY = 130 + stackIdx * 34
    let x: number
    let y: number
    if (t < 0.33) {
      const u = t / 0.33
      x = lerp(IN_X, OP1.x, u)
      y = lerp(startY, OP1.y, u)
    } else if (t < 0.66) {
      const u = (t - 0.33) / 0.33
      x = lerp(OP1.x, OP2.x, u)
      y = OP1.y
    } else {
      const u = (t - 0.66) / 0.34
      x = lerp(OP2.x, OUT_X - 70, u)
      y = lerp(OP2.y, rowY(k), u)
    }
    g.attr('transform', `translate(${x},${y})`).attr('opacity', t <= 0 ? 0 : t >= 1 ? 0 : 1)
  }

  return (s: Sample) => {
    const pFlow = phase(tl, s, 'a dataflow')
    const pBatch = phase(tl, s, 'the batch way')
    const pDiff = phase(tl, s, 'differences, not snapshots')
    const pFront = phase(tl, s, 'timestamps and the frontier')
    const pWhy = phase(tl, s, 'why it scales')

    // ── act 1: base records flow once; counts fill as chips land ──
    const tally = new Map(KEYS.map((k) => [k, 0]))
    BASE.forEach((k, i) => {
      const t = stagger(pFlow, i, BASE.length, 0.55)
      if (pFlow > 0 && pBatch === 0) flyChip(baseChips[i], k, t, i)
      else baseChips[i].attr('opacity', 0)
      if (t >= 1) tally.set(k, (tally.get(k) ?? 0) + 1)
    })

    // ── act 2: everything replays (batch), plus the new record ──
    if (pBatch > 0) {
      const all = [...BASE, '/b']
      all.forEach((k, i) => {
        const g = i < BASE.length ? baseChips[i] : newChipBatch
        const t = stagger(pBatch, i, all.length, 0.75)
        if (pBatch < 1) flyChip(g, k, t, i % 6)
        else g.attr('opacity', 0)
      })
      if (pBatch >= 1) {
        tally.set('/b', (tally.get('/b') ?? 0) + 1)
      } else {
        // table "rebuilding": recount what has landed this replay
        KEYS.forEach((k) => tally.set(k, 0))
        all.forEach((k, i) => {
          if (stagger(pBatch, i, all.length, 0.75) >= 1) tally.set(k, (tally.get(k) ?? 0) + 1)
        })
      }
      batchWork.text(`batch work: ${Math.round(clamp01(pBatch) * 10000).toLocaleString()} records`)
    } else {
      batchWork.text('')
    }

    // ── act 3: a single delta flows ──
    if (pDiff > 0) {
      // batch result is the baseline now
      KEYS.forEach((k) => tally.set(k, BASE.filter((b) => b === k).length))
      tally.set('/b', (tally.get('/b') ?? 0) + 1)
      const t = clamp01(pDiff * 1.25)
      if (pDiff < 1) flyChip(deltaChip, '/b', t, 2)
      else deltaChip.attr('opacity', 0)
      if (t >= 1) tally.set('/b', (tally.get('/b') ?? 0) + 1)
      diffWork.text(`differential work: ${t >= 1 ? 1 : 0} record`)
    } else {
      deltaChip.attr('opacity', 0)
      if (pBatch === 0) diffWork.text('')
    }

    // ── act 4: timestamped deltas + the frontier ──
    frontierAxis.attr('opacity', pFront > 0 ? 0.8 : 0)
    tickLabs.forEach((l) => l.attr('opacity', pFront > 0 ? 0.9 : 0))
    if (pFront > 0) {
      const frontierT = 3.5 + pFront * 3.4 // sweeps past t=4,5,6
      frontierLine.attr('x1', ftX(Math.min(frontierT, 6.6))).attr('x2', ftX(Math.min(frontierT, 6.6))).attr('opacity', 1)
      frontierLab.attr('x', ftX(Math.min(frontierT, 6.6))).attr('opacity', 1)
      DELTAS.forEach((d, i) => {
        // chip flies early, then WAITS at the output edge until the frontier passes its time
        const flight = clamp01(pFront * 3 - i * 0.55)
        const committed = frontierT >= d.t + 0.45
        const waitT = Math.min(flight, 0.97)
        if (!committed) {
          flyChip(tsChips[i], d.key, waitT, i * 2)
        } else {
          tsChips[i].attr('opacity', 0)
        }
        if (committed) tally.set(d.key, (tally.get(d.key) ?? 0) + d.diff)
      })
      diffWork.text(`differential work: ${DELTAS.filter((d) => 3.5 + pFront * 3.4 >= d.t + 0.45).length + 1} records`)
    } else {
      tsChips.forEach((c) => c.attr('opacity', 0))
      frontierLine.attr('opacity', 0)
      frontierLab.attr('opacity', 0)
    }

    // ── act 5: the comparison ──
    if (pWhy > 0) {
      batchWork.text('batch work: 10,000 records').attr('opacity', 1)
      diffWork.text('differential work: 4 records').attr('opacity', 1)
    }

    // paint counts + flash rows on change
    for (const k of KEYS) {
      const lab = counts.get(k)!
      const next = String(tally.get(k) ?? 0)
      if (lab.text() !== next) {
        lab.text(next)
        rowFlash.get(k)!.attr('opacity', 0.28)
      } else {
        const cur = Number(rowFlash.get(k)!.attr('opacity'))
        if (cur > 0.005) rowFlash.get(k)!.attr('opacity', cur * 0.9)
      }
    }

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'differential-dataflow',
  title: 'Differential dataflow — work proportional to change',
  summary: 'A counting pipeline: batch recomputes the world per change; differential ships (data, time, ±1) deltas and the frontier decides when outputs commit.',
  acts: ACTS,
  setup,
}

export function DifferentialDataflow() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
