import React from 'react'
import * as d3 from 'd3'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette, surface } from '../core/theme'
import { caption, clamp01, fmt, glowFilter, mathLabel, writeOn, type G } from '../core/draw'

// Three optimizers race on a tilted double-well with a curved valley. The
// hyperparameters are tuned (verified numerically) so the story is true:
// plain GD parks in the nearest (local) basin, momentum's velocity carries it
// over the ridge into the global one, Adam converges fast — but locally.

const f = (x: number, y: number) =>
  (x * x - 1) ** 2 - 0.3 * x + 1 + 1.2 * (y - 0.35 * Math.sin(2.2 * x)) ** 2
const grad = (x: number, y: number): [number, number] => {
  const s = Math.sin(2.2 * x)
  const c = Math.cos(2.2 * x)
  const gy = 2 * 1.2 * (y - 0.35 * s)
  return [4 * x * (x * x - 1) - 0.3 + gy * (-0.35 * 2.2 * c), gy]
}

const START: [number, number] = [-2.05, 1.1]
const STEPS = 600

function simulate(kind: 'gd' | 'mom' | 'adam'): [number, number][] {
  let [x, y] = START
  let vx = 0,
    vy = 0
  let mx = 0,
    my = 0,
    sx = 0,
    sy = 0
  const path: [number, number][] = [[x, y]]
  for (let i = 1; i <= STEPS; i++) {
    const [gx, gy] = grad(x, y)
    if (kind === 'gd') {
      const eta = 0.01
      x -= eta * gx
      y -= eta * gy
    } else if (kind === 'mom') {
      const eta = 0.006
      const b = 0.92
      vx = b * vx - eta * gx
      vy = b * vy - eta * gy
      x += vx
      y += vy
    } else {
      const eta = 0.08
      const b1 = 0.9,
        b2 = 0.999,
        eps = 1e-8
      mx = b1 * mx + (1 - b1) * gx
      my = b1 * my + (1 - b1) * gy
      sx = b2 * sx + (1 - b2) * gx * gx
      sy = b2 * sy + (1 - b2) * gy * gy
      const mhx = mx / (1 - b1 ** i)
      const mhy = my / (1 - b1 ** i)
      const shx = sx / (1 - b2 ** i)
      const shy = sy / (1 - b2 ** i)
      x -= (eta * mhx) / (Math.sqrt(shx) + eps)
      y -= (eta * mhy) / (Math.sqrt(shy) + eps)
    }
    path.push([x, y])
  }
  return path
}

const ACTS: Act[] = [
  {
    name: 'the loss landscape',
    duration: 3000,
    hold: 400,
    say: 'This is a loss landscape. Two valleys — and the one on the right is deeper.',
  },
  {
    name: 'gradient descent',
    duration: 3800,
    hold: 500,
    say: 'Plain gradient descent follows the slope downhill, straight into the nearest valley. And there it stays. Stuck.',
  },
  {
    name: 'momentum',
    duration: 3800,
    hold: 500,
    say: 'Momentum remembers its velocity. Watch it carry enough speed to sail over the ridge, into the deeper valley.',
  },
  {
    name: 'Adam',
    duration: 3800,
    hold: 500,
    say: 'Adam adapts its step size in every direction. Fast, and smooth — but adaptivity alone does not escape local minima.',
  },
  {
    name: 'compare',
    duration: 2400,
    hold: 1000,
    say: 'Same start. Same gradients. Three different fates.',
  },
]

const CAPTIONS: Record<string, string> = {
  'the loss landscape': 'two valleys — the right one is deeper',
  'gradient descent': 'follow −∇f downhill… straight into the nearest valley',
  momentum: 'velocity remembers the descent — enough to clear the ridge',
  Adam: 'adaptive step sizes: fast and smooth — but adaptivity ≠ escape',
  compare: 'same start, same gradients — three different fates',
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  const xDom: [number, number] = [-2.6, 2.6]
  const yDom: [number, number] = [-1.4625, 1.4625] // preserves 16:9
  const X = d3.scaleLinear().domain(xDom).range([0, width])
  const Y = d3.scaleLinear().domain(yDom).range([height, 0])

  const glow = glowFilter(defs, 'gd-glow', 4)
  const root = svg.append('g') as G

  // contour field
  const gn = 208,
    gm = 117
  const values = new Float64Array(gn * gm)
  for (let j = 0; j < gm; j++) {
    for (let i = 0; i < gn; i++) {
      const x = xDom[0] + ((i + 0.5) / gn) * (xDom[1] - xDom[0])
      const y = yDom[1] - ((j + 0.5) / gm) * (yDom[1] - yDom[0])
      values[j * gn + i] = f(x, y)
    }
  }
  const levels = d3.range(16).map((i) => 0.62 + 0.28 * (Math.pow(1.38, i) - 1))
  const contours = d3.contours().size([gn, gm]).thresholds(levels)(values as unknown as number[])
  const geo = d3.geoPath(d3.geoIdentity().scale(width / gn))
  const fillScale = d3.scaleLinear<string>().domain([0, levels.length - 1]).range(['#20304f', surface])
  const contourLayer = root.append('g') as G
  const contourPaths = contours.map((c, i) =>
    contourLayer
      .append('path')
      .attr('d', geo(c))
      .attr('fill', fillScale(i))
      .attr('stroke', palette.blue)
      .attr('stroke-opacity', 0.14)
      .attr('stroke-width', 0.8)
      .attr('opacity', 0),
  )

  // minima markers
  const marks = root.append('g') as G
  const localMin = marks.append('g')
  localMin
    .append('circle')
    .attr('cx', X(-0.96))
    .attr('cy', Y(-0.3))
    .attr('r', 3.5)
    .attr('fill', 'none')
    .attr('stroke', ink.secondary)
  mathLabel(localMin as unknown as G, { x: X(-0.96) - 14, y: Y(-0.3) + 5, text: 'local', color: ink.secondary, size: 14, italic: false, anchor: 'end', halo: surface })
  const globalMin = marks.append('g')
  globalMin.append('circle').attr('cx', X(1.036)).attr('cy', Y(0.266)).attr('r', 3.5).attr('fill', palette.green)
  mathLabel(globalMin as unknown as G, { x: X(1.036) + 14, y: Y(0.266) + 5, text: 'global', color: palette.green, size: 14, italic: false, anchor: 'start', halo: surface })

  // start marker
  const start = root.append('g') as G
  start.append('circle').attr('cx', X(START[0])).attr('cy', Y(START[1])).attr('r', 4).attr('fill', ink.primary)
  mathLabel(start, { x: X(START[0]), y: Y(START[1]) - 12, text: 'start', color: ink.primary, size: 14, italic: false })

  // optimizer trails + balls
  const series = [
    { key: 'gd', act: 'gradient descent', color: palette.blue, label: 'gradient descent', path: simulate('gd'), labelDy: 34 },
    { key: 'mom', act: 'momentum', color: palette.yellow, label: 'momentum', path: simulate('mom'), labelDy: -16 },
    { key: 'adam', act: 'Adam', color: palette.purple, label: 'Adam', path: simulate('adam'), labelDy: -60 },
  ].map((sr) => {
    const line = d3
      .line<[number, number]>()
      .x((p) => X(p[0]))
      .y((p) => Y(p[1]))
    const trail = root
      .append('path')
      .attr('d', line(sr.path))
      .attr('fill', 'none')
      .attr('stroke', sr.color)
      .attr('stroke-width', 2.4)
      .attr('opacity', 0)
    const ball = root.append('circle').attr('r', 6).attr('fill', sr.color).attr('filter', glow).attr('opacity', 0)
    const label = mathLabel(root, { x: 0, y: 0, text: sr.label, color: sr.color, size: 15, italic: false, halo: surface })
    label.attr('opacity', 0)
    const readout = mathLabel(root, { x: 0, y: 0, text: '', color: palette.gold, size: 14, mono: true, halo: surface })
    readout.attr('opacity', 0)
    // cumulative arc length so the ball rides the stroke-dash write-on frontier
    // (step count ≠ arc length: momentum's early steps cover huge distances)
    const cum: number[] = [0]
    for (let i = 1; i < sr.path.length; i++) {
      const [ax, ay] = sr.path[i - 1]
      const [bx, by] = sr.path[i]
      cum.push(cum[i - 1] + Math.hypot(X(bx) - X(ax), Y(by) - Y(ay)))
    }
    return { ...sr, trail, ball, label, readout, cum }
  })

  const cap = caption(root, { x: width / 2, y: height - 18, text: '', size: 16 })
  mathLabel(root, { x: width - 26, y: 40, text: 'f(x, y)', color: ink.secondary, size: 18, anchor: 'end' })

  return (s: Sample) => {
    const pLand = phase(tl, s, 'the loss landscape')
    for (let i = 0; i < contourPaths.length; i++) {
      const t = clamp01(pLand * 1.8 - (i / contourPaths.length) * 0.8)
      contourPaths[i].attr('opacity', t)
    }
    marks.attr('opacity', clamp01(pLand * 2 - 1))
    start.attr('opacity', clamp01(pLand * 2 - 1))

    const pCompare = phase(tl, s, 'compare')
    for (const sr of series) {
      const p = phase(tl, s, sr.act)
      const reveal = p
      writeOn(sr.trail as d3.Selection<SVGPathElement, unknown, null, undefined>, reveal)
      sr.trail.attr('opacity', reveal > 0 ? 0.85 : 0)
      // index at the revealed arc-length fraction (binary search)
      const targetLen = reveal * sr.cum[sr.cum.length - 1]
      let lo = 0
      let hi = sr.cum.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (sr.cum[mid] < targetLen) lo = mid + 1
        else hi = mid
      }
      const idx = lo
      const [x, y] = sr.path[idx]
      sr.ball.attr('cx', X(x)).attr('cy', Y(y)).attr('opacity', reveal > 0 ? 1 : 0)
      sr.label
        .attr('x', X(x))
        .attr('y', Y(y) + sr.labelDy)
        .attr('opacity', reveal > 0.05 ? 0.9 : 0)
      sr.readout
        .attr('x', X(x))
        .attr('y', Y(y) + sr.labelDy + (sr.labelDy < 0 ? -18 : 18))
        .text(`f = ${fmt(f(x, y))}`)
        .attr('opacity', pCompare * 0.95)
    }

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'gradient-descent',
  title: 'Why momentum escapes local minima',
  summary: 'Three optimizers race on a two-valley landscape; only momentum escapes the local minimum.',
  acts: ACTS,
  setup,
}

export function GradientDescent() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
