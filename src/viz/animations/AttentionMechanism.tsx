import React from 'react'
import * as d3 from 'd3'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { font, ink, palette, surface } from '../core/theme'
import { caption, clamp01, fmt, lerp, mathLabel, mulberry32, stagger, type G } from '../core/draw'

// Scaled dot-product attention, computed for real: seeded embeddings are
// projected to Q/K/V, one query ("lifts") scores every key, softmax turns the
// scores into weights, and the value vectors are actually mixed. The finale
// reveals the full n×n attention matrix.

const TOKENS = ['the', 'robot', 'lifts', 'the', 'heavy', 'box']
const QUERY = 2 // "lifts"
const D = 4

function buildAttention() {
  // seed 6 chosen by search: the verb's query lands on its object ("box" α≈.44)
  // and subject ("robot" α≈.22) — the pattern a trained head would show.
  const rand = mulberry32(6)
  const g = () => (rand() * 2 - 1) * 1.0
  const E = TOKENS.map(() => Array.from({ length: D }, g))
  // repeated token "the" shares its embedding
  E[3] = [...E[0]]
  const proj = (gain = 0.7) => Array.from({ length: D }, () => Array.from({ length: D }, () => g() * gain))
  const Wq = proj(),
    Wk = proj(),
    Wv = proj()
  // sharpen the head: scaling Wq scales every score linearly (softmax stays exact)
  for (const row of Wq) for (let i = 0; i < D; i++) row[i] *= 2.5
  const apply = (W: number[][], v: number[]) => W.map((row) => row.reduce((s, w, i) => s + w * v[i], 0))
  const Q = E.map((e) => apply(Wq, e))
  const K = E.map((e) => apply(Wk, e))
  const Vv = E.map((e) => apply(Wv, e))
  const scores = Q.map((q) => K.map((k) => q.reduce((s, v, i) => s + v * k[i], 0) / Math.sqrt(D)))
  const softmax = (row: number[]) => {
    const m = Math.max(...row)
    const ex = row.map((v) => Math.exp(v - m))
    const Z = ex.reduce((s, v) => s + v, 0)
    return ex.map((v) => v / Z)
  }
  const A = scores.map(softmax)
  const out = A[QUERY].reduce(
    (acc, a, j) => acc.map((v, i) => v + a * Vv[j][i]),
    Array.from({ length: D }, () => 0),
  )
  return { E, Q, K, V: Vv, scores, A, out }
}

const ACTS: Act[] = [
  {
    name: 'tokens become vectors',
    duration: 3000,
    hold: 300,
    say: 'Every token in the sentence becomes a learned vector. To the model, that vector is all a word is.',
  },
  {
    name: 'queries, keys, values',
    duration: 3400,
    hold: 300,
    say: 'Each vector is projected three ways: a query that asks, a key that answers, and a value that carries the content.',
  },
  {
    name: 'one token asks',
    duration: 3800,
    hold: 500,
    say: 'The word lifts compares its query against every key. One dot product per pair — that is the score.',
  },
  {
    name: 'softmax',
    duration: 3000,
    hold: 400,
    say: 'Softmax turns the scores into weights that sum to one. Lifts attends mostly to box — the thing being lifted.',
  },
  {
    name: 'mix the values',
    duration: 3600,
    hold: 500,
    say: 'The output is a weighted blend of the value vectors. That blend is attention.',
  },
  {
    name: 'every pair at once',
    duration: 3600,
    hold: 1000,
    say: 'And every token does this at the same time. N squared pairs, computed in one matrix multiply.',
  },
]

const CAPTIONS: Record<string, string> = {
  'tokens become vectors': 'each token is just a learned vector',
  'queries, keys, values': 'three projections of the same vector: q (asks), k (answers), v (carries)',
  'one token asks': '“lifts” compares its q with every k:  score = q·k / √d',
  softmax: 'softmax: scores become weights that sum to 1',
  'mix the values': 'the output is a weighted blend:  out = Σ αⱼ · vⱼ',
  'every pair at once': 'now every token does this — n² pairs, one matrix multiply',
}

// diverging cell shade: pink (−) → surface → teal (+)
const cellColor = d3.scaleLinear<string>().domain([-1.6, 0, 1.6]).range([palette.pink, '#1a2030', palette.teal]).clamp(true)

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  void defs
  const att = buildAttention()
  const root = svg.append('g') as G

  const xFor = (j: number) => 160 + j * 128
  const CELL = 15

  // token chips
  const chips = TOKENS.map((tok, j) => {
    const g = root.append('g') as G
    const w = 24 + tok.length * 9
    g.append('rect')
      .attr('x', xFor(j) - w / 2)
      .attr('y', 46)
      .attr('width', w)
      .attr('height', 28)
      .attr('rx', 8)
      .attr('fill', '#1a2030')
      .attr('stroke', j === QUERY ? palette.yellow : ink.axis)
      .attr('stroke-width', j === QUERY ? 1.6 : 1)
    g.append('text')
      .attr('x', xFor(j))
      .attr('y', 65)
      .attr('text-anchor', 'middle')
      .attr('fill', j === QUERY ? palette.yellow : ink.primary)
      .attr('font-family', font.ui)
      .attr('font-size', 15)
      .text(tok)
    return g
  })

  // embedding stacks
  const embCells = TOKENS.map((_, j) =>
    d3.range(D).map((i) =>
      root
        .append('rect')
        .attr('x', xFor(j) - CELL / 2)
        .attr('y', 92 + i * (CELL + 2))
        .attr('width', CELL)
        .attr('height', CELL)
        .attr('rx', 3)
        .attr('fill', cellColor(att.E[j][i]))
        .attr('opacity', 0),
    ),
  )

  // q/k/v mini stacks
  const QKV_Y = 190
  const small = 11
  const qkvColors = { q: palette.blue, k: palette.purple, v: palette.green }
  const qkvCells = TOKENS.map((_, j) => {
    const groups = (['q', 'k', 'v'] as const).map((kind, gi) => {
      const gx = xFor(j) + (gi - 1) * 22
      const vec = kind === 'q' ? att.Q[j] : kind === 'k' ? att.K[j] : att.V[j]
      const cells = d3.range(D).map((i) =>
        root
          .append('rect')
          .attr('x', gx - small / 2)
          .attr('y', QKV_Y + i * (small + 1.5))
          .attr('width', small)
          .attr('height', small)
          .attr('rx', 2.5)
          .attr('fill', cellColor(vec[i]))
          .attr('stroke', qkvColors[kind])
          .attr('stroke-width', 0.8)
          .attr('stroke-opacity', 0.7)
          .attr('opacity', 0),
      )
      return { kind, cells, gx }
    })
    return groups
  })
  // q/k/v legend on the first token
  const qkvLegend = (['q', 'k', 'v'] as const).map((kind, gi) =>
    mathLabel(root, {
      x: xFor(0) + (gi - 1) * 22,
      y: QKV_Y + D * (small + 1.5) + 16,
      text: kind,
      color: qkvColors[kind],
      size: 15,
    }),
  )
  qkvLegend.forEach((l) => l.attr('opacity', 0))

  // arcs from the query token to every token (scores band)
  const ARC_Y = 262
  const arcPath = (j: number) => {
    const x1 = xFor(QUERY)
    const x2 = xFor(j)
    const lift = j === QUERY ? 36 : Math.min(120, Math.abs(x2 - x1) * 0.34 + 30)
    return `M${x1},${ARC_Y} C${x1},${ARC_Y + lift} ${x2},${ARC_Y + lift} ${x2},${ARC_Y}`
  }
  const arcs = TOKENS.map((_, j) =>
    root
      .append('path')
      .attr('d', arcPath(j))
      .attr('fill', 'none')
      .attr('stroke', palette.yellow)
      .attr('opacity', 0),
  )
  const scoreLabs = TOKENS.map((_, j) => {
    const lab = mathLabel(root, {
      x: xFor(j),
      y: ARC_Y + 24,
      text: '',
      color: ink.primary,
      size: 13,
      mono: true,
      halo: surface,
    })
    return lab.attr('opacity', 0)
  })

  // softmax bars
  const BAR_Y = 402
  const bars = TOKENS.map((_, j) =>
    root
      .append('rect')
      .attr('x', xFor(j) - 13)
      .attr('y', BAR_Y)
      .attr('width', 26)
      .attr('height', 0)
      .attr('rx', 3)
      .attr('fill', palette.yellow)
      .attr('opacity', 0.9),
  )
  const alphaLabs = TOKENS.map((_, j) => {
    const lab = mathLabel(root, { x: xFor(j), y: BAR_Y + 18, text: '', color: ink.secondary, size: 12, mono: true })
    return lab.attr('opacity', 0)
  })
  const barBase = root
    .append('line')
    .attr('x1', xFor(0) - 30)
    .attr('x2', xFor(TOKENS.length - 1) + 30)
    .attr('y1', BAR_Y)
    .attr('y2', BAR_Y)
    .attr('stroke', ink.axis)
    .attr('opacity', 0)

  // flying value stacks + output
  const OUT_X = xFor(QUERY)
  const OUT_Y = 448
  const flyCells = TOKENS.map((_, j) =>
    d3.range(D).map((i) =>
      root
        .append('rect')
        .attr('width', small)
        .attr('height', small)
        .attr('rx', 2.5)
        .attr('fill', cellColor(att.V[j][i]))
        .attr('opacity', 0),
    ),
  )
  const outCells = d3.range(D).map((i) =>
    root
      .append('rect')
      .attr('x', OUT_X - CELL / 2 + (i - (D - 1) / 2) * (CELL + 3))
      .attr('y', OUT_Y)
      .attr('width', CELL)
      .attr('height', CELL)
      .attr('rx', 3)
      .attr('fill', cellColor(att.out[i]))
      .attr('stroke', palette.yellow)
      .attr('stroke-width', 1)
      .attr('opacity', 0),
  )
  const outLab = mathLabel(root, {
    x: OUT_X,
    y: OUT_Y + 36,
    text: 'out(lifts) = Σ αⱼ · vⱼ',
    color: ink.primary,
    size: 15,
  })
  outLab.attr('opacity', 0)

  // finale: full attention matrix overlay
  const HM = 40
  const hmX = width / 2 - (TOKENS.length * HM) / 2 + 40
  const hmY = 116
  const overlay = root.append('g') as G
  overlay
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height)
    .attr('fill', surface)
    .attr('opacity', 0.94)
  const blueRamp = d3.scaleSequential((t: number) => d3.interpolateRgb('#131a2c', palette.blue)(t)).domain([0, 0.75])
  const hmCells: d3.Selection<SVGRectElement, unknown, null, undefined>[] = []
  for (let qi = 0; qi < TOKENS.length; qi++) {
    for (let kj = 0; kj < TOKENS.length; kj++) {
      hmCells.push(
        overlay
          .append('rect')
          .attr('x', hmX + kj * HM)
          .attr('y', hmY + qi * HM)
          .attr('width', HM - 3)
          .attr('height', HM - 3)
          .attr('rx', 4)
          .attr('fill', blueRamp(att.A[qi][kj])),
      )
    }
  }
  TOKENS.forEach((tok, i) => {
    overlay
      .append('text')
      .attr('x', hmX - 12)
      .attr('y', hmY + i * HM + HM / 2 + 2)
      .attr('text-anchor', 'end')
      .attr('fill', i === QUERY ? palette.yellow : ink.secondary)
      .attr('font-size', 13)
      .attr('font-family', font.ui)
      .text(tok)
    overlay
      .append('text')
      .attr('x', hmX + i * HM + (HM - 3) / 2)
      .attr('y', hmY - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', ink.secondary)
      .attr('font-size', 13)
      .attr('font-family', font.ui)
      .text(tok)
  })
  mathLabel(overlay as unknown as G, {
    x: width / 2 + 40,
    y: hmY + TOKENS.length * HM + 44,
    text: 'A = softmax(QKᵀ/√d)   —   n² pairs',
    color: ink.primary,
    size: 18,
  })
  overlay.attr('opacity', 0).style('pointer-events', 'none')

  const cap = caption(root, { x: width / 2, y: height - 14, text: '', size: 15 })

  return (s: Sample) => {
    const pTok = phase(tl, s, 'tokens become vectors')
    const pQkv = phase(tl, s, 'queries, keys, values')
    const pAsk = phase(tl, s, 'one token asks')
    const pSoft = phase(tl, s, 'softmax')
    const pMix = phase(tl, s, 'mix the values')
    const pAll = phase(tl, s, 'every pair at once')

    chips.forEach((c, j) => c.attr('opacity', stagger(pTok, j, TOKENS.length, 0.7)))
    embCells.forEach((cells, j) =>
      cells.forEach((c, i) => c.attr('opacity', stagger(pTok, j * D + i + 6, TOKENS.length * D + 6, 0.9))),
    )
    qkvCells.forEach((groups, j) =>
      groups.forEach((gr, gi) =>
        gr.cells.forEach((c) => c.attr('opacity', stagger(pQkv, j * 3 + gi, TOKENS.length * 3, 0.8))),
      ),
    )
    qkvLegend.forEach((l) => l.attr('opacity', pQkv))

    // raw scores: arc thickness ∝ |score|, dashed when negative
    arcs.forEach((a, j) => {
      const sc = att.scores[QUERY][j]
      const alpha = att.A[QUERY][j]
      const reveal = stagger(pAsk, j, TOKENS.length, 0.55)
      const w = pSoft > 0 ? 1 + alpha * 10 : 1 + Math.abs(sc) * 2.2
      const op = pSoft > 0 ? 0.25 + alpha * 0.75 : reveal * (0.3 + Math.min(Math.abs(sc) / 2, 0.6))
      a.attr('stroke-width', lerp(1 + Math.abs(sc) * 2.2, 1 + alpha * 10, pSoft))
        .attr('stroke-dasharray', sc < 0 && pSoft < 0.5 ? '4,5' : null)
        .attr('opacity', reveal > 0 ? op : 0)
    })
    scoreLabs.forEach((lab, j) => {
      const sc = att.scores[QUERY][j]
      const alpha = att.A[QUERY][j]
      const reveal = stagger(pAsk, j, TOKENS.length, 0.55)
      lab
        .text(pSoft > 0.5 ? `α=${fmt(alpha)}` : fmt(sc, 2))
        .attr('opacity', reveal * (1 - pAll))
        .attr('fill', pSoft > 0.5 ? palette.yellow : ink.primary)
    })

    barBase.attr('opacity', pSoft * 0.7)
    bars.forEach((b, j) => {
      const h = att.A[QUERY][j] * 90 * pSoft
      b.attr('y', BAR_Y - h).attr('height', h).attr('opacity', pSoft * 0.9)
    })
    alphaLabs.forEach((l, j) => l.text(fmt(att.A[QUERY][j], 2)).attr('opacity', pSoft * 0.8))

    // value stacks fly from each token to the output slot, opacity ∝ α
    flyCells.forEach((cells, j) => {
      const alpha = att.A[QUERY][j]
      const tt = stagger(pMix, j, TOKENS.length, 0.45)
      const sx = qkvCells[j][2].gx
      const sy = QKV_Y
      const txx = OUT_X + (j - (TOKENS.length - 1) / 2) * 8
      cells.forEach((c, i) => {
        const x = lerp(sx - small / 2, txx, tt)
        const y = lerp(sy + i * (small + 1.5), OUT_Y - 2 - (D - i) * 3, tt)
        c.attr('x', x)
          .attr('y', y)
          .attr('opacity', pMix > 0 && tt < 1 ? (0.25 + alpha * 0.75) * Math.sin(Math.PI * Math.min(tt, 0.999)) : 0)
      })
    })
    outCells.forEach((c, i) => c.attr('opacity', clamp01(pMix * 1.6 - 0.5 - i * 0.04)))
    outLab.attr('opacity', clamp01(pMix * 2 - 0.9))

    // finale
    overlay.attr('opacity', pAll > 0 ? clamp01(pAll * 1.5) * 1 : 0)
    hmCells.forEach((c, idx) => {
      const qi = Math.floor(idx / TOKENS.length)
      c.attr('opacity', stagger(pAll, qi, TOKENS.length, 0.6))
    })

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'attention-mechanism',
  title: 'Attention — how a token decides what to look at',
  summary: 'Tokens → Q/K/V; one query scores every key, softmax mixes the values; finale is the n×n matrix.',
  acts: ACTS,
  setup,
}

export function AttentionMechanism() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
