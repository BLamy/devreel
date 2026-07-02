import React from 'react'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { caption, clamp01, glowFilter, mathLabel, writeOn, type G } from '../core/draw'
import type * as d3 from 'd3'

// KL divergence, honestly integrated: P = N(−0.6, 0.55), Q = N(0.7, 0.95).
// The integrand p·log(p/q) is traced pointwise (positive area teal, negative
// pink), the counter integrates to the true value — then the roles swap and
// the number comes out wildly different. Not a distance.

const P = { mu: -0.6, sd: 0.55 }
const Q = { mu: 0.7, sd: 0.95 }
const gauss = (d: { mu: number; sd: number }) => (x: number) =>
  Math.exp(-((x - d.mu) ** 2) / (2 * d.sd * d.sd)) / (d.sd * Math.sqrt(2 * Math.PI))
const p = gauss(P)
const q = gauss(Q)

const X0 = -3.4
const X1 = 4.0
const N = 560

const ACTS: Act[] = [
  {
    name: 'two beliefs',
    duration: 2800,
    hold: 300,
    say: 'Two probability distributions. Call the blue one P — the truth. The yellow one, Q, is your model of it.',
  },
  {
    name: 'pointwise surprise',
    duration: 3400,
    hold: 300,
    say: 'At every point, compare them: the log of p over q. Positive where the model under-believes, negative where it over-believes.',
  },
  {
    name: 'weight by P',
    duration: 3000,
    hold: 500,
    say: 'Now weight that surprise by how often truth actually goes there, and add it all up. That number is the KL divergence from Q to P.',
  },
  {
    name: 'swap them',
    duration: 3400,
    hold: 600,
    say: 'Swap the roles — measure the model’s surprise at the truth instead — and you get a completely different number. KL is not symmetric. It is not a distance.',
  },
  {
    name: 'why ML cares',
    duration: 2600,
    hold: 1000,
    say: 'And here is why machine learning cares: minimizing cross-entropy loss is exactly minimizing the KL divergence between the data and your model.',
  },
]

const CAPTIONS: Record<string, string> = {
  'two beliefs': 'P = the data, Q = the model',
  'pointwise surprise': 'log(p(x)/q(x)) — where the model is wrong, and in which direction',
  'weight by P': 'KL(P‖Q) = ∫ p(x)·log(p(x)/q(x)) dx',
  'swap them': 'KL(Q‖P) ≠ KL(P‖Q) — asymmetric by construction',
  'why ML cares': 'cross-entropy = H(P) + KL(P‖Q): training minimizes exactly this',
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  const glow = glowFilter(defs, 'kl-glow', 3)
  const root = svg.append('g') as G

  const PX = (x: number) => 60 + ((x - X0) / (X1 - X0)) * (width - 120)
  const topY = (v: number) => 252 - v * 250
  const botBase = 452
  const botScale = 132

  const xs = Array.from({ length: N + 1 }, (_, i) => X0 + ((X1 - X0) * i) / N)
  const dx = (X1 - X0) / N

  // true KL values (trapezoid)
  const integrand1 = (x: number) => p(x) * Math.log(p(x) / q(x))
  const integrand2 = (x: number) => q(x) * Math.log(q(x) / p(x))
  const KL1 = xs.reduce((s, x) => s + integrand1(x) * dx, 0)
  const KL2 = xs.reduce((s, x) => s + integrand2(x) * dx, 0)

  // top: the two densities
  root.append('line').attr('x1', PX(X0)).attr('x2', PX(X1)).attr('y1', topY(0)).attr('y2', topY(0)).attr('stroke', ink.axis)
  const pPath = root.append('path').attr('fill', 'none').attr('stroke', palette.blue).attr('stroke-width', 2.6)
  const qPath = root.append('path').attr('fill', 'none').attr('stroke', palette.yellow).attr('stroke-width', 2.6)
  pPath.attr('d', xs.map((x, i) => (i === 0 ? 'M' : 'L') + PX(x).toFixed(1) + ',' + topY(p(x)).toFixed(1)).join(''))
  qPath.attr('d', xs.map((x, i) => (i === 0 ? 'M' : 'L') + PX(x).toFixed(1) + ',' + topY(q(x)).toFixed(1)).join(''))
  mathLabel(root, { x: PX(P.mu), y: topY(p(P.mu)) - 12, text: 'P', color: palette.blue, size: 21 })
  mathLabel(root, { x: PX(Q.mu), y: topY(q(Q.mu)) - 12, text: 'Q', color: palette.yellow, size: 21 })

  // bottom: the integrand, filled by sign
  root.append('line').attr('x1', PX(X0)).attr('x2', PX(X1)).attr('y1', botBase).attr('y2', botBase).attr('stroke', ink.axis)
  const areaPos = root.append('path').attr('fill', palette.teal).attr('opacity', 0.4)
  const areaNeg = root.append('path').attr('fill', palette.pink).attr('opacity', 0.4)
  const integrandPath = root.append('path').attr('fill', 'none').attr('stroke', ink.primary).attr('stroke-width', 1.4)
  const scan = root.append('line').attr('stroke', palette.gold).attr('stroke-width', 1).attr('stroke-dasharray', '3,4')
  const scanDot = root.append('circle').attr('r', 4).attr('fill', palette.gold).attr('filter', glow)

  const klLab = mathLabel(root, { x: width - 44, y: 350, text: '', color: palette.gold, size: 21, anchor: 'end', mono: true })
  const kl2Lab = mathLabel(root, { x: width - 44, y: 378, text: '', color: ink.secondary, size: 15, anchor: 'end', mono: true })
  const cap = caption(root, { x: width / 2, y: height - 16, text: '', size: 15 })

  const buildPaths = (fn: (x: number) => number, upTo: number) => {
    let line = ''
    let pos = 'M' + PX(X0).toFixed(1) + ',' + botBase
    let neg = 'M' + PX(X0).toFixed(1) + ',' + botBase
    let acc = 0
    for (let i = 0; i <= N; i++) {
      const x = xs[i]
      if (x > upTo) break
      const v = fn(x)
      const y = botBase - v * botScale
      line += (i === 0 ? 'M' : 'L') + PX(x).toFixed(1) + ',' + y.toFixed(1)
      pos += 'L' + PX(x).toFixed(1) + ',' + Math.min(y, botBase).toFixed(1)
      neg += 'L' + PX(x).toFixed(1) + ',' + Math.max(y, botBase).toFixed(1)
      acc += v * dx
    }
    pos += 'L' + PX(Math.min(upTo, X1)).toFixed(1) + ',' + botBase + 'Z'
    neg += 'L' + PX(Math.min(upTo, X1)).toFixed(1) + ',' + botBase + 'Z'
    return { line, pos, neg, acc }
  }

  return (s: Sample) => {
    const pIntro = phase(tl, s, 'two beliefs')
    const pScan = phase(tl, s, 'pointwise surprise')
    const pWeight = phase(tl, s, 'weight by P')
    const pSwap = phase(tl, s, 'swap them')
    const pWhy = phase(tl, s, 'why ML cares')

    writeOn(pPath as d3.Selection<SVGPathElement, unknown, null, undefined>, pIntro)
    writeOn(qPath as d3.Selection<SVGPathElement, unknown, null, undefined>, clamp01(pIntro * 1.4 - 0.3))

    // which integrand: P-weighted, crossfading to Q-weighted during the swap
    const swapped = pSwap > 0.5
    const fn = swapped ? integrand2 : integrand1
    const scanX = X0 + (X1 - X0) * (pScan < 1 ? pScan : pSwap > 0 && pSwap < 1 ? pSwap : 1)

    if (pScan > 0) {
      const upTo = pSwap > 0 && pSwap < 1 ? X0 + (X1 - X0) * pSwap : X0 + (X1 - X0) * Math.max(pScan, pWeight)
      const { line, pos, neg, acc } = buildPaths(fn, upTo)
      integrandPath.attr('d', line || 'M0,0').attr('opacity', 0.9)
      areaPos.attr('d', pos).attr('opacity', 0.15 + 0.3 * Math.max(pWeight, pSwap))
      areaNeg.attr('d', neg).attr('opacity', 0.15 + 0.3 * Math.max(pWeight, pSwap))
      const x = Math.min(upTo, X1 - 1e-6)
      scan
        .attr('x1', PX(x))
        .attr('x2', PX(x))
        .attr('y1', 60)
        .attr('y2', botBase + 60)
        .attr('opacity', upTo < X1 ? 0.6 : 0)
      scanDot.attr('cx', PX(x)).attr('cy', botBase - fn(x) * botScale).attr('opacity', upTo < X1 ? 1 : 0)
      const showAcc = pWeight > 0 || pSwap > 0
      klLab
        .text(showAcc ? `KL(${swapped ? 'Q‖P' : 'P‖Q'}) = ${acc.toFixed(3)}` : '')
        .attr('fill', swapped ? palette.yellow : palette.blue)
      kl2Lab.text(pSwap >= 1 || pWhy > 0 ? `vs  KL(P‖Q) = ${KL1.toFixed(3)}  ·  KL(Q‖P) = ${KL2.toFixed(3)}` : '')
    } else {
      integrandPath.attr('opacity', 0)
      areaPos.attr('opacity', 0)
      areaNeg.attr('opacity', 0)
      scan.attr('opacity', 0)
      scanDot.attr('opacity', 0)
      klLab.text('')
      kl2Lab.text('')
    }
    void scanX

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'kl-divergence',
  title: 'KL divergence — the cost of believing Q when the truth is P',
  summary: 'Two distributions compared pointwise; the weighted surprise integrates to KL — and it is not symmetric.',
  acts: ACTS,
  setup,
}

export function KLDivergence() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
