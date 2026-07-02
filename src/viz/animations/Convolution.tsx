import React, { useMemo } from 'react'
import * as d3 from 'd3'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { caption, clamp01, glowFilter, mathLabel, type G } from '../core/draw'

// Convolution as flip-and-slide: the kernel sweeps across the signal, the
// yellow region is the pointwise product, and its integral drops one point of
// the output curve at a time. Parameterized by kernel: a Gaussian bump gives
// smoothing/blur; its derivative gives edge detection — a CNN's first layer.

export type KernelKind = 'smooth' | 'edge'

const X0 = 0
const X1 = 10
const N = 500

// signal: a boxcar and a triangle
const f = (x: number) => {
  const box = x >= 2 && x <= 4 ? 1 : 0
  const tri = x >= 6 && x <= 8 ? 1 - Math.abs(x - 7) : 0
  return box + tri
}

const kernels: Record<KernelKind, { k: (u: number) => number; halfWidth: number; label: string }> = {
  smooth: {
    k: (u) => Math.exp(-(u * u) / (2 * 0.35 * 0.35)) / (0.35 * Math.sqrt(2 * Math.PI)),
    halfWidth: 1.2,
    label: 'k = Gaussian bump (area 1)',
  },
  edge: {
    k: (u) => (-u / 0.18) * Math.exp(-(u * u) / (2 * 0.3 * 0.3)),
    halfWidth: 1.2,
    label: 'k = derivative of Gaussian (odd)',
  },
}

function makeActs(kind: KernelKind): Act[] {
  return [
    {
      name: 'two functions',
      duration: 3000,
      hold: 300,
      say:
        kind === 'smooth'
          ? 'Two functions: a signal, and a little Gaussian bump we will call the kernel.'
          : 'Two functions: a signal, and an odd little kernel — the derivative of a Gaussian. Positive on one side, negative on the other.',
    },
    {
      name: 'flip and slide',
      duration: 3400,
      hold: 300,
      say: 'Flip the kernel, and slide it along. At every position, multiply the two functions together — that is the glowing region.',
    },
    {
      name: 'multiply, then sum',
      duration: 3800,
      hold: 300,
      say: 'The area of that glowing product becomes a single number: one point of the output. Slide, multiply, sum. Slide, multiply, sum.',
    },
    {
      name: 'the result',
      duration: 3800,
      hold: 400,
      say:
        kind === 'smooth'
          ? 'The output is the signal, softened. Convolving with a bump is a moving average — this is blur, this is smoothing, this is every low-pass filter you have ever used.'
          : 'The output fires only where the signal changes — silent on the plateaus, loud at every edge.',
    },
    {
      name: 'why it matters',
      duration: 2600,
      hold: 1000,
      say:
        kind === 'smooth'
          ? 'Swap the kernel and the same machine does something completely different. That is why convolution is everywhere: one operation, endless filters.'
          : 'This is exactly what the first layer of a convolutional network does: it learns kernels like this one, and drags them across the image, hunting for edges.',
    },
  ]
}

function makeCaptions(kind: KernelKind): Record<string, string> {
  return {
    'two functions': kernels[kind].label,
    'flip and slide': '(f ∗ k)(s) — slide the flipped kernel to position s',
    'multiply, then sum': 'the glowing area  =  ∫ f(x) · k(s−x) dx  =  one output point',
    'the result': kind === 'smooth' ? 'convolution with a bump = moving average = blur' : 'an odd kernel responds only to change',
    'why it matters': kind === 'smooth' ? 'one machine, endless filters' : 'this is a CNN’s first layer',
  }
}

function makeSetup(kind: KernelKind) {
  return function setup({ svg, defs, width, height, tl }: SceneCtx) {
    const { k, halfWidth } = kernels[kind]
    const glow = glowFilter(defs, `cv-glow-${kind}`, 3)
    void glow
    const root = svg.append('g') as G

    const CAPTIONS = makeCaptions(kind)
    const top = { y: 196, amp: 78 }
    const bot = { y: 448, amp: kind === 'smooth' ? 78 : 46 }
    const PX = (x: number) => 60 + ((x - X0) / (X1 - X0)) * (width - 120)

    // precompute the convolution on a grid
    const out: number[] = []
    let outMax = 0
    for (let j = 0; j <= N; j++) {
      const sPos = X0 + (j / N) * (X1 - X0)
      let acc = 0
      const du = (2 * halfWidth) / 160
      for (let u = -halfWidth; u <= halfWidth; u += du) {
        acc += f(sPos - u) * k(u) * du
      }
      out.push(acc)
      outMax = Math.max(outMax, Math.abs(acc))
    }

    // axes
    for (const y of [top.y, bot.y]) {
      root.append('line').attr('x1', PX(X0)).attr('x2', PX(X1)).attr('y1', y).attr('y2', y).attr('stroke', ink.axis)
    }

    // signal
    const sigPath = root.append('path').attr('fill', 'none').attr('stroke', palette.blue).attr('stroke-width', 2.2)
    {
      let d = ''
      for (let j = 0; j <= N; j++) {
        const x = X0 + (j / N) * (X1 - X0)
        d += (j === 0 ? 'M' : 'L') + PX(x).toFixed(1) + ',' + (top.y - f(x) * top.amp).toFixed(1)
      }
      sigPath.attr('d', d)
    }
    mathLabel(root, { x: PX(0.1), y: top.y - top.amp - 18, text: 'f', color: palette.blue, size: 19, anchor: 'start' })

    // kernel (drawn flipped around the current position s)
    const kerPath = root.append('path').attr('fill', 'none').attr('stroke', palette.purple).attr('stroke-width', 2.2)
    const kMax = Math.max(...d3.range(-halfWidth, halfWidth, 0.01).map((u) => Math.abs(k(u))))
    const kScale = 60 / kMax
    mathLabel(root, { x: PX(9.9), y: top.y - top.amp - 18, text: 'k (flipped)', color: palette.purple, size: 17, anchor: 'end' })

    // product fill
    const product = root.append('path').attr('fill', palette.yellow).attr('fill-opacity', 0.45).attr('stroke', 'none')

    // output
    const outPath = root.append('path').attr('fill', 'none').attr('stroke', palette.green).attr('stroke-width', 2.4)
    const outDot = root.append('circle').attr('r', 4.5).attr('fill', palette.green).attr('filter', `url(#cv-glow-${kind})`)
    const dropLine = root
      .append('line')
      .attr('stroke', palette.yellow)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,5')
      .attr('opacity', 0.6)
    mathLabel(root, { x: PX(0.1), y: bot.y - bot.amp - 40, text: 'f ∗ k', color: palette.green, size: 19, anchor: 'start' })

    const cap = caption(root, { x: width / 2, y: height - 16, text: '', size: 15 })

    return (s: Sample) => {
      const pIntro = phase(tl, s, 'two functions')
      const pSlide = phase(tl, s, 'flip and slide')
      const pSum = phase(tl, s, 'multiply, then sum')
      const pRest = phase(tl, s, 'the result')
      const pWhy = phase(tl, s, 'why it matters')

      sigPath.attr('opacity', clamp01(pIntro * 2))

      // kernel position accumulates across the acts
      const sPos = -1.3 + (3 + 1.3) * pSlide + 3 * pSum + (10 + 1.3 - 6) * pRest

      // kernel curve k(s - x) around sPos
      let kd = ''
      let first = true
      for (let u = -halfWidth; u <= halfWidth; u += halfWidth / 60) {
        const x = sPos - u
        if (x < X0 || x > X1) continue
        const y = top.y - k(u) * kScale
        kd += (first ? 'M' : 'L') + PX(x).toFixed(1) + ',' + y.toFixed(1)
        first = false
      }
      kerPath.attr('d', kd || 'M0,0').attr('opacity', clamp01(pIntro * 2 - 0.6))

      // product region: f(x)·k(s−x), scaled
      if (pSlide > 0) {
        let pd = ''
        const pts: [number, number][] = []
        for (let u = -halfWidth; u <= halfWidth; u += halfWidth / 60) {
          const x = sPos - u
          if (x < X0 || x > X1) continue
          pts.push([x, f(x) * k(u)])
        }
        if (pts.length > 1) {
          pd = 'M' + PX(pts[0][0]).toFixed(1) + ',' + top.y
          for (const [x, v] of pts) pd += 'L' + PX(x).toFixed(1) + ',' + (top.y - v * kScale * 0.8).toFixed(1)
          pd += 'L' + PX(pts[pts.length - 1][0]).toFixed(1) + ',' + top.y + 'Z'
        }
        product.attr('d', pd || 'M0,0').attr('opacity', 0.5)
      } else {
        product.attr('opacity', 0)
      }

      // output reveal up to sPos
      const revealJ = Math.max(0, Math.min(N, Math.round(((sPos - X0) / (X1 - X0)) * N)))
      let od = ''
      for (let j = 0; j <= revealJ; j++) {
        const x = X0 + (j / N) * (X1 - X0)
        od += (j === 0 ? 'M' : 'L') + PX(x).toFixed(1) + ',' + (bot.y - (out[j] / outMax) * bot.amp).toFixed(1)
      }
      outPath.attr('d', od || 'M0,0').attr('opacity', pSlide > 0 ? 1 : 0)
      const curX = Math.max(X0, Math.min(X1, sPos))
      const curV = out[Math.max(0, Math.min(N, revealJ))]
      outDot
        .attr('cx', PX(curX))
        .attr('cy', bot.y - (curV / outMax) * bot.amp)
        .attr('opacity', pSlide > 0 && pWhy < 0.5 ? 1 : 0)
      dropLine
        .attr('x1', PX(curX))
        .attr('y1', top.y + 8)
        .attr('x2', PX(curX))
        .attr('y2', bot.y - (curV / outMax) * bot.amp - 8)
        .attr('opacity', pSum > 0 && pWhy < 0.5 ? 0.5 : 0)

      const text = CAPTIONS[s.name] ?? ''
      cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
    }
  }
}

export const definitions: VizDefinition[] = [
  {
    id: 'convolution-smooth',
    title: 'Convolution — flip, slide, multiply, sum',
    summary: 'Flip–slide–multiply–sum with a Gaussian kernel: blur / moving average / low-pass.',
    acts: makeActs('smooth'),
    setup: makeSetup('smooth'),
  },
  {
    id: 'convolution-edge',
    title: 'Convolution as edge detection — a CNN’s first layer',
    summary: 'Same machine with a derivative kernel: fires only at changes — a CNN first layer.',
    acts: makeActs('edge'),
    setup: makeSetup('edge'),
  },
]

export interface ConvolutionProps {
  kernel?: KernelKind
  title?: string
}

export function Convolution({ kernel = 'smooth', title }: ConvolutionProps) {
  const acts = useMemo(() => makeActs(kernel), [kernel])
  const setup = useMemo(() => makeSetup(kernel), [kernel])
  const defaultTitle =
    kernel === 'smooth' ? 'Convolution — flip, slide, multiply, sum' : 'Convolution as edge detection — a CNN’s first layer'
  return <Scene title={title ?? defaultTitle} acts={acts} setup={setup} />
}
