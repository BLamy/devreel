import React from 'react'
import * as d3 from 'd3'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { caption, clamp01, mathLabel, mulberry32, writeOn, type G } from '../core/draw'

// A Galton board: every ball takes ten fair coin-flips on the way down, and
// the pile underneath is a binomial — visibly a bell. Each ball's entire path
// is a pure function of the clock (seeded flips, fixed release times), so the
// rain replays identically under scrubbing.

const ROWS = 10
const BALLS = 220
const DX = 26
const TOP_X = 480
const PEG_Y0 = 96
const ROW_DY = 25
const FLOOR_Y = 500
const STACK_DY = 2.4

const T_ONE = 3400 // board-time for the single slow ball
const T_RAIN = 6200 // board-time span of the rain act

const ACTS: Act[] = [
  {
    name: 'one ball',
    duration: 3600,
    hold: 400,
    say: 'Drop one ball. At every peg, a fair coin flip — left, or right. Ten flips later, it lands in a bin.',
  },
  {
    name: 'two hundred more',
    duration: 6400,
    hold: 400,
    say: 'Now drop two hundred more. Every path is pure chance. Jagged, unpredictable — individually hopeless to forecast.',
  },
  {
    name: 'the bell emerges',
    duration: 3000,
    hold: 700,
    say: 'But the pile is not chaos. Sums of independent coin flips stack into a bell curve. Every time.',
  },
  {
    name: 'the central limit theorem',
    duration: 2600,
    hold: 1000,
    say: 'That is the central limit theorem. Add up enough small independent effects, and the Gaussian is inevitable. It is why the bell curve shows up everywhere you look.',
  },
]

const CAPTIONS: Record<string, string> = {
  'one ball': '10 pegs = 10 coin flips',
  'two hundred more': 'every path is random — the pile is not',
  'the bell emerges': 'binomial(10, ½) → the bell',
  'the central limit theorem': 'many small independent effects  ⇒  Gaussian',
}

interface Ball {
  bits: number[] // L/R flips
  bin: number
  release: number // board-time ms
  rowMs: number // time per row
  stack: number // resting order within its bin
  el?: SVGCircleElement
}

function buildBalls(): Ball[] {
  const rand = mulberry32(4242)
  const balls: Ball[] = []
  const binCount = new Array(ROWS + 1).fill(0)
  for (let k = 0; k < BALLS; k++) {
    const bits: number[] = Array.from({ length: ROWS }, () => (rand() < 0.5 ? 0 : 1))
    const bin = bits.reduce((a, b) => a + b, 0)
    const release = k === 0 ? 0 : T_ONE + ((k - 1) / (BALLS - 2)) * (T_RAIN * 0.72)
    const rowMs = k === 0 ? 290 : 95
    balls.push({ bits, bin, release, rowMs, stack: binCount[bin]++ })
  }
  return balls
}

const pegY = (r: number) => PEG_Y0 + r * ROW_DY
const binX = (b: number) => TOP_X + b * DX - (ROWS * DX) / 2
// x offset after r bounces
const pathX = (bits: number[], r: number) => {
  let sum = 0
  for (let i = 0; i < r; i++) sum += bits[i]
  return TOP_X + sum * DX - (r * DX) / 2
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  void defs
  const balls = buildBalls()
  const root = svg.append('g') as G

  // pegs
  const pegs = root.append('g') as G
  for (let r = 0; r < ROWS; r++) {
    for (let i = 0; i <= r; i++) {
      pegs
        .append('circle')
        .attr('cx', TOP_X + i * DX - (r * DX) / 2)
        .attr('cy', pegY(r + 1))
        .attr('r', 2.2)
        .attr('fill', ink.axis)
    }
  }
  // bin dividers
  const bins = root.append('g') as G
  for (let b = 0; b <= ROWS + 1; b++) {
    bins
      .append('line')
      .attr('x1', binX(b) - DX / 2)
      .attr('x2', binX(b) - DX / 2)
      .attr('y1', pegY(ROWS + 1) + 10)
      .attr('y2', FLOOR_Y + 4)
      .attr('stroke', ink.grid)
  }
  bins
    .append('line')
    .attr('x1', binX(0) - DX / 2)
    .attr('x2', binX(ROWS + 1) - DX / 2)
    .attr('y1', FLOOR_Y + 4)
    .attr('y2', FLOOR_Y + 4)
    .attr('stroke', ink.axis)

  // balls
  for (const b of balls) {
    b.el = root
      .append('circle')
      .attr('r', b === balls[0] ? 4 : 2.8)
      .attr('fill', b === balls[0] ? palette.yellow : palette.blue)
      .attr('opacity', 0)
      .node()!
  }

  // gaussian overlay: expected binomial counts through the bin centers
  const choose = (n: number, k: number): number => {
    let r = 1
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
    return r
  }
  const gauss = root.append('path').attr('fill', 'none').attr('stroke', palette.green).attr('stroke-width', 2.5)
  {
    const pts: [number, number][] = []
    for (let x = -0.8; x <= ROWS + 0.8; x += 0.1) {
      // smooth interpolation of expected count via the normal approximation
      const mu = ROWS / 2
      const sig = Math.sqrt(ROWS / 4)
      const density = Math.exp(-((x - mu) ** 2) / (2 * sig * sig)) / (sig * Math.sqrt(2 * Math.PI))
      const expected = BALLS * density // ≈ BALLS · C(n,k)/2^n at integers (bin width 1)
      pts.push([binX(x), FLOOR_Y - expected * STACK_DY])
    }
    void choose
    const line = d3.line()
    gauss.attr('d', line(pts))
  }

  const nLab = mathLabel(root, { x: 40, y: 50, text: '', color: palette.gold, size: 16, anchor: 'start', mono: true })
  mathLabel(root, { x: width - 36, y: 50, text: 'p(left) = p(right) = ½', color: ink.secondary, size: 15, anchor: 'end' })
  const cap = caption(root, { x: width / 2, y: height - 16, text: '', size: 15 })

  // position of a ball at local time (ms since its release); returns null before release
  const pos = (b: Ball, local: number): [number, number] | null => {
    if (local < 0) return null
    const totalRows = ROWS
    const rowF = local / b.rowMs
    if (rowF < totalRows) {
      const r = Math.floor(rowF)
      const u = rowF - r
      const e = u * u * (3 - 2 * u)
      const x0 = pathX(b.bits, r)
      const x1 = pathX(b.bits, r + 1)
      return [x0 + (x1 - x0) * e, pegY(r) + (pegY(r + 1) - pegY(r)) * u]
    }
    // final fall into the stack
    const restY = FLOOR_Y - b.stack * STACK_DY - 3
    const fallStart = pegY(totalRows)
    const fallMs = 240
    const u = Math.min((local - totalRows * b.rowMs) / fallMs, 1)
    const y = fallStart + (restY - fallStart) * (u * u)
    return [binX(b.bin), Math.min(y, restY)]
  }

  return (s: Sample) => {
    const pOne = phase(tl, s, 'one ball')
    const pRain = phase(tl, s, 'two hundred more')
    const pBell = phase(tl, s, 'the bell emerges')
    const pClt = phase(tl, s, 'the central limit theorem')

    // board clock advances through the two drop acts, then freezes
    const tau = pOne * T_ONE + pRain * T_RAIN + (pBell > 0 ? 60000 : 0)

    let landed = 0
    for (const b of balls) {
      const p = pos(b, tau - b.release)
      if (!p) {
        b.el!.setAttribute('opacity', '0')
        continue
      }
      b.el!.setAttribute('cx', String(p[0]))
      b.el!.setAttribute('cy', String(p[1]))
      b.el!.setAttribute('opacity', '0.95')
      if (tau - b.release > ROWS * b.rowMs + 240) landed++
    }
    nLab.text(`balls landed: ${landed}`)

    writeOn(gauss as d3.Selection<SVGPathElement, unknown, null, undefined>, pBell)
    gauss.attr('opacity', pBell > 0 ? 0.95 : 0)
    void pClt

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'central-limit',
  title: 'The central limit theorem — order from coin flips',
  summary: 'A Galton board: 220 balls of coin flips stack into a bell curve.',
  acts: ACTS,
  setup,
}

export function CentralLimit() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
