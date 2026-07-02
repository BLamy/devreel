import React from 'react'
import * as d3 from 'd3'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { caption, clamp01, fmt, glowFilter, mathLabel, writeOn, type G } from '../core/draw'

// 3b1b's "winding machine" for the Fourier transform: wind the signal
// g(t) = 1.2 + cos(2π·2t) + 0.6·cos(2π·3t) around a circle at a chosen
// frequency f. The center of mass barely moves — until f matches a note
// hiding in the signal. Tracking |center of mass| across f IS the transform.

const F1 = 2
const F2 = 3
const g = (t: number) => 1.2 + Math.cos(2 * Math.PI * F1 * t) + 0.6 * Math.cos(2 * Math.PI * F2 * t)
const T_MAX = 3 // seconds of signal
const N = 600

const ACTS: Act[] = [
  {
    name: 'a chord of two notes',
    duration: 3200,
    hold: 300,
    say: 'Here is a signal made of two pure notes, at two hertz and three hertz, mixed together. Which frequencies are inside it? You cannot tell by looking.',
  },
  {
    name: 'wrap it around a circle',
    duration: 3600,
    hold: 300,
    say: 'So wind the signal around a circle. The winding speed is ours to choose. The gold dot is the center of mass of the wound-up graph.',
  },
  {
    name: 'sweep to two hertz',
    duration: 3800,
    hold: 700,
    say: 'Sweep the winding frequency. Mostly the wraps cancel out and the center of mass hugs zero. But at exactly two hertz, the wraps line up, and it lurches away.',
  },
  {
    name: 'and three',
    duration: 3200,
    hold: 700,
    say: 'Keep sweeping. There is the second note, hiding at three hertz.',
  },
  {
    name: 'the Fourier transform',
    duration: 3000,
    hold: 1000,
    say: 'Track the center of mass across every frequency, and this curve is what you get. That is the Fourier transform — the spikes are the notes the signal is made of.',
  },
]

const CAPTIONS: Record<string, string> = {
  'a chord of two notes': 'g(t) = 1.2 + cos(2π·2t) + 0.6·cos(2π·3t)',
  'wrap it around a circle': 'wind g around a circle at frequency f — gold = center of mass',
  'sweep to two hertz': 'wraps cancel… until f matches a note inside the signal',
  'and three': 'a second resonance at f = 3',
  'the Fourier transform': '|ĝ(f)| = how far the center of mass strays — the transform itself',
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  const glow = glowFilter(defs, 'fw-glow', 4)
  const root = svg.append('g') as G

  // panels
  const wind = { x: 235, y: 265, r: 58 } // px per unit of g
  const sig = { x0: 470, x1: 930, y: 118, amp: 26 }
  const spec = { x0: 470, x1: 930, y0: 462, y1: 322, fMax: 4 }

  // signal strip
  mathLabel(root, { x: sig.x0, y: sig.y - 62, text: 'g(t)', color: palette.blue, size: 16, anchor: 'start' })
  const sigPath = root.append('path').attr('fill', 'none').attr('stroke', palette.blue).attr('stroke-width', 2)
  {
    let d = ''
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * T_MAX
      d += (i === 0 ? 'M' : 'L') + (sig.x0 + (t / T_MAX) * (sig.x1 - sig.x0)).toFixed(1) + ',' + (sig.y - (g(t) - 1.2) * sig.amp).toFixed(1)
    }
    sigPath.attr('d', d)
  }
  root
    .append('line')
    .attr('x1', sig.x0)
    .attr('x2', sig.x1)
    .attr('y1', sig.y)
    .attr('y2', sig.y)
    .attr('stroke', ink.grid)

  // winding panel
  root.append('circle').attr('cx', wind.x).attr('cy', wind.y).attr('r', wind.r).attr('fill', 'none').attr('stroke', ink.grid)
  root.append('line').attr('x1', wind.x - 190).attr('x2', wind.x + 190).attr('y1', wind.y).attr('y2', wind.y).attr('stroke', ink.grid)
  root.append('line').attr('x1', wind.x).attr('x2', wind.x).attr('y1', wind.y - 190).attr('y2', wind.y + 190).attr('stroke', ink.grid)
  const wound = root.append('path').attr('fill', 'none').attr('stroke', palette.teal).attr('stroke-width', 1.4).attr('opacity', 0.85)
  const com = root.append('circle').attr('r', 5).attr('fill', palette.gold).attr('filter', glow)
  const fLab = mathLabel(root, { x: wind.x, y: 62, text: '', color: palette.gold, size: 19, mono: true })

  // spectrum: precompute |ĝ(f)| on a grid
  const F_GRID = 260
  const spectrum: number[] = []
  let specMax = 0
  for (let j = 0; j <= F_GRID; j++) {
    const f = (j / F_GRID) * spec.fMax
    let re = 0
    let im = 0
    for (let i = 0; i < N; i++) {
      const t = (i / N) * T_MAX
      const val = g(t)
      const a = -2 * Math.PI * f * t
      re += val * Math.cos(a)
      im += val * Math.sin(a)
    }
    const mag = Math.hypot(re / N, im / N)
    spectrum.push(mag)
    if (f > 0.4) specMax = Math.max(specMax, mag)
  }
  const specX = (f: number) => spec.x0 + (f / spec.fMax) * (spec.x1 - spec.x0)
  const specY = (m: number) => spec.y0 - (Math.min(m, specMax) / specMax) * (spec.y0 - spec.y1)
  root.append('line').attr('x1', spec.x0).attr('x2', spec.x1).attr('y1', spec.y0).attr('y2', spec.y0).attr('stroke', ink.axis)
  for (const f of [1, 2, 3, 4]) {
    root
      .append('line')
      .attr('x1', specX(f))
      .attr('x2', specX(f))
      .attr('y1', spec.y0)
      .attr('y2', spec.y0 + 5)
      .attr('stroke', ink.axis)
    mathLabel(root, { x: specX(f), y: spec.y0 + 22, text: `${f}`, color: ink.secondary, size: 13, mono: true })
  }
  mathLabel(root, { x: spec.x0, y: spec.y1 - 14, text: '|ĝ(f)|', color: palette.yellow, size: 16, anchor: 'start' })
  mathLabel(root, { x: spec.x1, y: spec.y0 + 22, text: 'f (Hz)', color: ink.secondary, size: 13, anchor: 'end' })
  const specPath = root.append('path').attr('fill', 'none').attr('stroke', palette.yellow).attr('stroke-width', 2.2)
  {
    let d = ''
    for (let j = 0; j <= F_GRID; j++) {
      const f = (j / F_GRID) * spec.fMax
      d += (j === 0 ? 'M' : 'L') + specX(f).toFixed(1) + ',' + specY(spectrum[j]).toFixed(1)
    }
    specPath.attr('d', d)
  }
  const fMarker = root.append('line').attr('stroke', palette.gold).attr('stroke-width', 1).attr('stroke-dasharray', '3,4')
  const peak1 = mathLabel(root, { x: specX(F1), y: specY(spectrum[Math.round((F1 / spec.fMax) * F_GRID)]) - 12, text: '2 Hz', color: palette.yellow, size: 14 })
  const peak2 = mathLabel(root, { x: specX(F2), y: specY(spectrum[Math.round((F2 / spec.fMax) * F_GRID)]) - 12, text: '3 Hz', color: palette.yellow, size: 14 })

  const cap = caption(root, { x: width / 2, y: height - 16, text: '', size: 15 })

  return (s: Sample) => {
    const pSig = phase(tl, s, 'a chord of two notes')
    const pWrap = phase(tl, s, 'wrap it around a circle')
    const pTwo = phase(tl, s, 'sweep to two hertz')
    const pThree = phase(tl, s, 'and three')
    const pAll = phase(tl, s, 'the Fourier transform')

    writeOn(sigPath as d3.Selection<SVGPathElement, unknown, null, undefined>, pSig)

    // winding frequency accumulates across the sweep acts
    const f = 1.2 * pWrap + (F1 - 1.2) * pTwo + (F2 - F1) * pThree + (spec.fMax - F2) * pAll

    // wound signal + center of mass
    let d = ''
    let cx = 0
    let cy = 0
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * T_MAX
      const val = g(t)
      const a = -2 * Math.PI * f * t
      const x = wind.x + val * Math.cos(a) * wind.r
      const y = wind.y + val * Math.sin(a) * wind.r
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
      if (i < N) {
        cx += x
        cy += y
      }
    }
    wound.attr('d', d).attr('opacity', pWrap > 0 ? 0.85 : 0)
    com
      .attr('cx', cx / N)
      .attr('cy', cy / N)
      .attr('opacity', pWrap > 0 ? 1 : 0)
    fLab.text(pWrap > 0 ? `winding f = ${fmt(f)} Hz` : '')

    // spectrum reveals up to the current frequency
    writeOn(specPath as d3.Selection<SVGPathElement, unknown, null, undefined>, pWrap > 0 ? f / spec.fMax : 0)
    fMarker
      .attr('x1', specX(f))
      .attr('x2', specX(f))
      .attr('y1', spec.y0)
      .attr('y2', spec.y1)
      .attr('opacity', pWrap > 0 ? 0.6 : 0)
    peak1.attr('opacity', f >= F1 ? 1 : 0)
    peak2.attr('opacity', f >= F2 ? 1 : 0)

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'fourier-winding',
  title: 'The Fourier transform — a winding machine',
  summary: 'Wind a signal around a circle; the center of mass lurches at frequencies hidden inside — the transform itself.',
  acts: ACTS,
  setup,
}

export function FourierWinding() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
