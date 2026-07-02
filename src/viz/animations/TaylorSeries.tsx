import React from 'react'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { caption, clamp01, glowFilter, mathLabel, writeOn, type G } from '../core/draw'
import type * as d3 from 'd3'

// Polynomials hugging sin(x), one order at a time. The approximation morphs
// continuously — each new term's weight ramps 0→1 — so the curve visibly
// *reaches out* along the function as the order grows.

const ACTS: Act[] = [
  {
    name: 'a difficult function',
    duration: 3000,
    hold: 300,
    say: 'Here is sine. Your computer cannot evaluate it directly — no finite amount of adding and multiplying gives you sine exactly.',
  },
  {
    name: 'the best line',
    duration: 3000,
    hold: 400,
    say: 'So approximate. Near zero, the best possible line is simply y equals x. Close up, it is indistinguishable.',
  },
  {
    name: 'add a cubic',
    duration: 3200,
    hold: 400,
    say: 'Add a cubic term — x cubed over three factorial, subtracted — and the polynomial bends to follow the curve further out.',
  },
  {
    name: 'higher orders',
    duration: 3800,
    hold: 400,
    say: 'Fifth order. Seventh. Every new term extends the embrace — each one chosen to match one more derivative at zero.',
  },
  {
    name: 'the payoff',
    duration: 2800,
    hold: 1000,
    say: 'Inside this window, seven multiplications and additions compute sine to within a hair. That is a Taylor series — the reason your calculator works.',
  },
]

const CAPTIONS: Record<string, string> = {
  'a difficult function': 'sin(x) — smooth, but not computable by arithmetic alone',
  'the best line': 'T₁(x) = x — matches the value and the slope at 0',
  'add a cubic': 'T₃(x) = x − x³/3!',
  'higher orders': 'T₅ = … + x⁵/5!    T₇ = … − x⁷/7!',
  'the payoff': 'a polynomial — just × and + — carries sin across the whole window',
}

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1))

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  const glow = glowFilter(defs, 'ts-glow', 3)
  const root = svg.append('g') as G

  const X_MAX = 5.4
  const PX = (x: number) => width / 2 + (x / X_MAX) * (width / 2 - 40)
  const PY = (y: number) => 262 - y * 118

  // clip so high-order polynomials can dive off-panel without smearing the UI
  const clipId = 'ts-clip'
  defs.append('clipPath').attr('id', clipId).append('rect').attr('x', 30).attr('y', 48).attr('width', width - 60).attr('height', 428)
  const plot = root.append('g').attr('clip-path', `url(#${clipId})`) as G

  // axes
  plot.append('line').attr('x1', PX(-X_MAX)).attr('x2', PX(X_MAX)).attr('y1', PY(0)).attr('y2', PY(0)).attr('stroke', ink.axis)
  plot.append('line').attr('x1', PX(0)).attr('x2', PX(0)).attr('y1', 56).attr('y2', 470).attr('stroke', ink.axis)
  for (const m of [-Math.PI, Math.PI]) {
    plot.append('line').attr('x1', PX(m)).attr('x2', PX(m)).attr('y1', PY(0) - 5).attr('y2', PY(0) + 5).attr('stroke', ink.secondary)
    mathLabel(plot, { x: PX(m), y: PY(0) + 22, text: m < 0 ? '−π' : 'π', color: ink.secondary, size: 14 })
  }

  const N = 340
  const xs = Array.from({ length: N + 1 }, (_, i) => -X_MAX + (2 * X_MAX * i) / N)

  // sin
  const sinPath = plot.append('path').attr('fill', 'none').attr('stroke', palette.blue).attr('stroke-width', 2.6)
  sinPath.attr('d', xs.map((x, i) => (i === 0 ? 'M' : 'L') + PX(x).toFixed(1) + ',' + PY(Math.sin(x)).toFixed(1)).join(''))

  // the fit window band
  const band = plot
    .append('rect')
    .attr('y', 56)
    .attr('height', 414)
    .attr('fill', palette.teal)
    .attr('opacity', 0)

  // Taylor polynomial (redrawn per frame)
  const poly = plot.append('path').attr('fill', 'none').attr('stroke', palette.yellow).attr('stroke-width', 2.6)
  const anchor = plot.append('circle').attr('cx', PX(0)).attr('cy', PY(0)).attr('r', 4.5).attr('fill', palette.yellow).attr('filter', glow)

  const orderLab = mathLabel(root, { x: 40, y: 52, text: '', color: palette.gold, size: 18, anchor: 'start', mono: true })
  const termLab = mathLabel(root, { x: width - 40, y: 52, text: '', color: ink.secondary, size: 17, anchor: 'end' })
  mathLabel(root, { x: PX(2.1), y: PY(1) - 14, text: 'sin x', color: palette.blue, size: 19 })
  const cap = caption(root, { x: width / 2, y: height - 16, text: '', size: 15 })

  return (s: Sample) => {
    const pIntro = phase(tl, s, 'a difficult function')
    const pLine = phase(tl, s, 'the best line')
    const pCubic = phase(tl, s, 'add a cubic')
    const pHigh = phase(tl, s, 'higher orders')
    const pPay = phase(tl, s, 'the payoff')

    writeOn(sinPath as d3.Selection<SVGPathElement, unknown, null, undefined>, pIntro)

    // term weights ramp one after another
    const w3 = pCubic
    const w5 = clamp01(pHigh * 2)
    const w7 = clamp01(pHigh * 2 - 1)
    const T = (x: number) =>
      x - (w3 * Math.pow(x, 3)) / fact(3) + (w5 * Math.pow(x, 5)) / fact(5) - (w7 * Math.pow(x, 7)) / fact(7)

    if (pLine > 0) {
      poly.attr('d', xs.map((x, i) => (i === 0 ? 'M' : 'L') + PX(x).toFixed(1) + ',' + PY(T(x)).toFixed(1)).join(''))
      // write the line on during its act; afterwards it's fully drawn and morphing
      if (s.name === 'the best line') writeOn(poly as d3.Selection<SVGPathElement, unknown, null, undefined>, pLine)
      else poly.attr('stroke-dasharray', null).attr('stroke-dashoffset', null)
      poly.attr('opacity', 1)
    } else {
      poly.attr('opacity', 0)
    }
    anchor.attr('opacity', pLine > 0 ? 1 : 0)

    const order = w7 > 0 ? 7 : w5 > 0 ? 5 : w3 > 0 ? 3 : 1
    orderLab.text(pLine > 0 ? `order n = ${order}` : '')
    termLab.text(
      pLine > 0
        ? order === 1
          ? 'T₁ = x'
          : order === 3
            ? 'T₃ = x − x³/3!'
            : order === 5
              ? 'T₅ = x − x³/3! + x⁵/5!'
              : 'T₇ = x − x³/3! + x⁵/5! − x⁷/7!'
        : '',
    )

    // payoff: the window where |sin − T₇| < 0.05
    if (pPay > 0) {
      let lo = 0
      while (lo < X_MAX && Math.abs(Math.sin(-lo) - T(-lo)) < 0.05) lo += 0.02
      const half = lo * pPay
      band.attr('x', PX(-half)).attr('width', PX(half) - PX(-half)).attr('opacity', 0.1)
    } else {
      band.attr('opacity', 0)
    }

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'taylor-series',
  title: 'Taylor series — teaching polynomials to impersonate sin(x)',
  summary: 'Polynomials hug sin(x) one order at a time; higher orders hold on longer.',
  acts: ACTS,
  setup,
}

export function TaylorSeries() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
