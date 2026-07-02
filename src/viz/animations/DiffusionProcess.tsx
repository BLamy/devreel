import React from 'react'
import * as d3 from 'd3'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { caption, clamp01, fmt, gaussianPair, mathLabel, mulberry32, stagger, writeOn, type G } from '../core/draw'

// DDPM in one picture: x_t = √ᾱ_t·x₀ + √(1−ᾱ_t)·ε with a cosine schedule.
// Every point owns its ε, so its whole trajectory is a pure function of t —
// noising and denoising are literally the same path, played both ways.

const N = 380
const abar = (t: number) => Math.cos((Math.PI * clamp01(t)) / 2) ** 2

function buildData() {
  const rand = mulberry32(99)
  const pts: { x0: [number, number]; eps: [number, number]; moon: 0 | 1 }[] = []
  for (let i = 0; i < N; i++) {
    const moon = (i % 2) as 0 | 1
    const th = rand() * Math.PI
    const jx = (rand() * 2 - 1) * 0.07
    const jy = (rand() * 2 - 1) * 0.07
    const x0: [number, number] =
      moon === 0
        ? [Math.cos(th) - 0.5 + jx, Math.sin(th) - 0.25 + jy]
        : [1 - Math.cos(th) - 0.5 + jx, -Math.sin(th) + 0.5 - 0.25 + jy]
    pts.push({ x0, eps: gaussianPair(rand), moon })
  }
  return pts
}

const ACTS: Act[] = [
  {
    name: 'the data',
    duration: 2500,
    hold: 400,
    say: 'Here is a distribution worth learning: two interlocking moons.',
  },
  {
    name: 'forward: drown it in noise',
    duration: 5200,
    hold: 600,
    say: 'The forward process blends every point toward Gaussian noise, a little at each step.',
  },
  {
    name: 'pure noise',
    duration: 1200,
    hold: 900,
    say: 'All structure is gone. And yet, every point remembers exactly how it got here.',
  },
  {
    name: 'reverse: learn the way back',
    duration: 5200,
    hold: 500,
    say: 'A model trained to predict the noise can walk every step backwards. Denoising, one step at a time.',
  },
  {
    name: 'that is the whole trick',
    duration: 2200,
    hold: 1000,
    say: 'And that is a diffusion model. Start from pure noise, and denoise your way to data.',
  },
]

const CAPTIONS: Record<string, string> = {
  'the data': 'a distribution worth learning — two moons',
  'forward: drown it in noise': 'blend each point toward Gaussian noise, a little per step',
  'pure noise': 'all structure gone — and yet every point remembers its path',
  'reverse: learn the way back': 'a model trained to predict ε can walk every step backwards',
  'that is the whole trick': 'sampling = start from noise, denoise — that’s a diffusion model',
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  const pts = buildData()
  const C = { x: 385, y: 268 }
  const UNIT = 165 // px per data unit
  const NOISE = 120 // px per σ of ε

  const clipId = 'dp-clip'
  defs
    .append('clipPath')
    .attr('id', clipId)
    .append('rect')
    .attr('x', 40)
    .attr('y', 34)
    .attr('width', 660)
    .attr('height', 470)
  const root = svg.append('g') as G
  const plot = root.append('g').attr('clip-path', `url(#${clipId})`) as G

  // σ rings for the pure-noise beat
  const rings = [1, 2].map((k) =>
    plot
      .append('circle')
      .attr('cx', C.x)
      .attr('cy', C.y)
      .attr('r', k * NOISE)
      .attr('fill', 'none')
      .attr('stroke', ink.muted)
      .attr('stroke-dasharray', '4,7')
      .attr('opacity', 0),
  )
  const ringLabs = [1, 2].map((k) => {
    const l = mathLabel(plot, { x: C.x + k * NOISE + 4, y: C.y - 6, text: `${k}σ`, color: ink.muted, size: 13, anchor: 'start' })
    return l.attr('opacity', 0)
  })

  const dots = pts.map((p) =>
    plot
      .append('circle')
      .attr('r', 2.6)
      .attr('fill', p.moon === 0 ? palette.blue : palette.yellow)
      .attr('opacity', 0),
  )

  // noise-schedule inset
  const inset = root.append('g').attr('transform', 'translate(716, 64)') as G
  const IW = 200,
    IH = 104
  inset
    .append('rect')
    .attr('x', -14)
    .attr('y', -20)
    .attr('width', IW + 30)
    .attr('height', IH + 58)
    .attr('rx', 10)
    .attr('fill', '#0a0d15')
    .attr('opacity', 0.85)
  const sx = d3.scaleLinear().domain([0, 1]).range([0, IW])
  const sy = d3.scaleLinear().domain([0, 1]).range([IH, 0])
  inset.append('line').attr('x1', 0).attr('x2', IW).attr('y1', IH).attr('y2', IH).attr('stroke', ink.axis)
  inset.append('line').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', IH).attr('stroke', ink.axis)
  const schedLine = d3.line<number>().x((t) => sx(t)).y((t) => sy(abar(t)))
  const schedPath = inset
    .append('path')
    .attr('d', schedLine(d3.range(0, 1.001, 0.02)))
    .attr('fill', 'none')
    .attr('stroke', palette.teal)
    .attr('stroke-width', 2)
  const schedDot = inset.append('circle').attr('r', 4).attr('fill', palette.gold)
  mathLabel(inset, { x: IW / 2, y: IH + 24, text: 't', color: ink.secondary, size: 15 })
  mathLabel(inset, { x: -2, y: -6, text: 'ᾱ(t)', color: palette.teal, size: 15, anchor: 'start' })
  const readout = mathLabel(inset, { x: IW / 2, y: IH + 46, text: '', color: palette.gold, size: 14, mono: true })

  mathLabel(root, {
    x: 385,
    y: 40,
    text: 'xₜ = √ᾱₜ · x₀  +  √(1−ᾱₜ) · ε',
    color: ink.secondary,
    size: 18,
  })
  const dirLab = mathLabel(root, { x: 716 + IW / 2 - 14, y: 256, text: '', color: ink.primary, size: 16, italic: false })
  const cap = caption(root, { x: width / 2, y: height - 16, text: '', size: 15 })

  return (s: Sample) => {
    const pData = phase(tl, s, 'the data')
    const pFwd = phase(tl, s, 'forward: drown it in noise')
    const pNoise = phase(tl, s, 'pure noise')
    const pRev = phase(tl, s, 'reverse: learn the way back')
    const pEnd = phase(tl, s, 'that is the whole trick')

    const t = pFwd * (1 - pRev) // 0 → 1 → 0; pure function of the clock
    const a = abar(t)
    const sqA = Math.sqrt(a)
    const sqNA = Math.sqrt(1 - a)

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const x = C.x + (sqA * p.x0[0] * UNIT + sqNA * p.eps[0] * NOISE)
      const y = C.y - (sqA * p.x0[1] * UNIT + sqNA * p.eps[1] * NOISE)
      dots[i]
        .attr('cx', x)
        .attr('cy', y)
        .attr('opacity', stagger(pData, i % 60, 60, 0.9) * 0.85)
    }

    rings.forEach((r, k) => r.attr('opacity', (pNoise - pRev * pNoise) * 0.6 * (1 - k * 0.25) * (1 - pRev)))
    ringLabs.forEach((l) => l.attr('opacity', pNoise * (1 - pRev) * 0.7))

    writeOn(schedPath as d3.Selection<SVGPathElement, unknown, null, undefined>, clamp01(pFwd * 2))
    schedDot.attr('cx', sx(t)).attr('cy', sy(a)).attr('opacity', pFwd > 0 ? 1 : 0)
    readout.text(`t = ${fmt(t)}   ᾱ = ${fmt(a)}`)
    dirLab
      .text(pRev > 0 && pRev < 1 ? '◀ denoising' : pFwd > 0 && pFwd < 1 ? 'noising ▶' : '')
      .attr('fill', pRev > 0 ? palette.green : palette.red)

    // final beat: pulse the recovered structure
    if (pEnd > 0) {
      const pulse = 0.85 + 0.15 * Math.sin(pEnd * Math.PI * 3)
      for (const d of dots) d.attr('opacity', pulse * 0.85)
    }

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'diffusion-process',
  title: 'Diffusion models — destroy, then learn to un-destroy',
  summary: 'Two moons noised to a Gaussian and denoised back along the exact same paths.',
  acts: ACTS,
  setup,
}

export function DiffusionProcess() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
