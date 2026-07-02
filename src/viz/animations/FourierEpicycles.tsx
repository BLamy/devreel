import React from 'react'
import * as d3 from 'd3'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { caption, clamp01, glowFilter, mathLabel, type G } from '../core/draw'

// A square wave assembled from rotating vectors: f(θ) = Σ_{k odd} 4/(kπ)·sin(kθ).
// Every frame is a pure function of time — each harmonic has an "on time" and a
// smooth envelope, and the trace is re-evaluated analytically over the trailing
// window, so scrubbing replays history exactly.

const N_TERMS = 25
const CYCLE_MS = 4200 // one fundamental rotation
const OMEGA = (2 * Math.PI) / CYCLE_MS

const ACTS: Act[] = [
  {
    name: 'one circle',
    duration: 4200,
    say: 'Start with a single rotating vector. Its tip traces a pure sine wave — one frequency, one circle.',
  },
  {
    name: 'add the 3rd harmonic',
    duration: 4200,
    say: 'Now stack a smaller, faster circle on its tip, spinning three times as fast.',
  },
  {
    name: 'seven terms',
    duration: 5200,
    say: 'Keep going. Every odd harmonic we add sharpens the corners a little more.',
  },
  {
    name: 'twenty-five terms',
    duration: 6800,
    hold: 600,
    say: 'With twenty-five spinning circles we are drawing a square wave. Any signal you can name is just circles riding on circles.',
  },
]

const CAPTIONS: Record<string, string> = {
  'one circle': 'one rotating vector draws a pure sine',
  'add the 3rd harmonic': 'stack a smaller, faster circle on its tip',
  'seven terms': 'each odd harmonic sharpens the corners',
  'twenty-five terms': 'in the limit: a square wave — any signal is circles',
}

// harmonic k = 2i+1; when does term i switch on?
function onTimes(starts: number[]): number[] {
  const on: number[] = []
  for (let i = 0; i < N_TERMS; i++) {
    if (i === 0) on.push(0)
    else if (i === 1) on.push(starts[1])
    else if (i < 4) on.push(starts[2] + (i - 2) * 500)
    else on.push(starts[3] + (i - 4) * 140)
  }
  return on
}

const smooth = (t: number) => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  const center = { x: 235, y: 258 }
  const waveX = 470
  const waveEnd = width - 20
  const AMP = 96 // px per unit
  const WINDOW = 2.2 * CYCLE_MS
  const pxPerMs = (waveEnd - waveX) / WINDOW

  const on = onTimes(tl.starts)
  const amp = (i: number) => 4 / ((2 * i + 1) * Math.PI)
  const env = (i: number, time: number) => smooth((time - on[i]) / 700)

  const glow = glowFilter(defs, 'fe-glow', 4)
  const root = svg.append('g') as G

  // midline for the wave panel
  root
    .append('line')
    .attr('x1', waveX)
    .attr('x2', waveEnd)
    .attr('y1', center.y)
    .attr('y2', center.y)
    .attr('stroke', ink.grid)
  root
    .append('line')
    .attr('x1', waveX)
    .attr('x2', waveX)
    .attr('y1', center.y - 150)
    .attr('y2', center.y + 150)
    .attr('stroke', ink.axis)

  // harmonic chain: circle + radius vector per term
  type CircleSel = d3.Selection<SVGCircleElement, unknown, null, undefined>
  type LineSel = d3.Selection<SVGLineElement, unknown, null, undefined>
  const circles: CircleSel[] = []
  const radii: LineSel[] = []
  const chain = root.append('g') as G
  for (let i = 0; i < N_TERMS; i++) {
    circles.push(
      chain
        .append('circle')
        .attr('fill', 'none')
        .attr('stroke', ink.secondary)
        .attr('stroke-width', 1)
        .attr('opacity', 0),
    )
    radii.push(
      chain
        .append('line')
        .attr('stroke', palette.blue)
        .attr('stroke-width', i === 0 ? 2.5 : 1.8)
        .attr('opacity', 0),
    )
  }
  const tip = root.append('circle').attr('r', 4.5).attr('fill', palette.yellow).attr('filter', glow)
  const connector = root
    .append('line')
    .attr('stroke', palette.yellow)
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,5')
    .attr('opacity', 0.5)

  const trace = root
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', palette.yellow)
    .attr('stroke-width', 2.2)

  const nLab = mathLabel(root, { x: 30, y: 44, text: '', color: palette.gold, size: 18, anchor: 'start', mono: true })
  mathLabel(root, {
    x: width / 2,
    y: 42,
    text: 'f(θ) = Σ  4/(kπ) · sin(kθ),   k odd',
    color: ink.secondary,
    size: 18,
  })
  const cap = caption(root, { x: width / 2, y: height - 18, text: '', size: 16 })

  // y-value of the partial sum at global time τ (respecting each term's envelope at τ)
  const valueAt = (tau: number) => {
    let y = 0
    for (let i = 0; i < N_TERMS; i++) {
      const e = env(i, tau)
      if (e <= 0) break
      const k = 2 * i + 1
      y += e * amp(i) * Math.sin(k * OMEGA * tau)
    }
    return y
  }

  return (s: Sample) => {
    const theta = OMEGA * s.time

    // walk the chain: each vector rotates at k×, anchored on the previous tip
    let px = center.x
    let py = center.y
    let active = 0
    for (let i = 0; i < N_TERMS; i++) {
      const e = env(i, s.time)
      const k = 2 * i + 1
      const r = e * amp(i) * AMP
      circles[i]
        .attr('cx', px)
        .attr('cy', py)
        .attr('r', Math.max(r, 0.01))
        .attr('opacity', e * 0.35)
      const nx = px + r * Math.cos(k * theta)
      const ny = py - r * Math.sin(k * theta)
      radii[i]
        .attr('x1', px)
        .attr('y1', py)
        .attr('x2', nx)
        .attr('y2', ny)
        .attr('opacity', e * (0.9 - (0.5 * i) / N_TERMS))
      px = nx
      py = ny
      if (e > 0.5) active = i + 1
    }
    tip.attr('cx', px).attr('cy', py)

    // trailing trace, evaluated analytically over the window
    const samples = 260
    let d = ''
    for (let j = 0; j <= samples; j++) {
      const back = (j / samples) * Math.min(WINDOW, s.time)
      const tau = s.time - back
      const x = waveX + back * pxPerMs
      const y = center.y - valueAt(tau) * AMP
      d += (j === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
    }
    trace.attr('d', d)
    connector
      .attr('x1', px)
      .attr('y1', py)
      .attr('x2', waveX)
      .attr('y2', center.y - valueAt(s.time) * AMP)

    nLab.text(`N = ${active}   (k ≤ ${2 * active - 1})`)

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'fourier-epicycles',
  title: 'Fourier series — circles that draw a square wave',
  summary: 'Rotating vector chain draws a square wave; harmonics sharpen the corners.',
  acts: ACTS,
  setup,
}

export function FourierEpicycles() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
