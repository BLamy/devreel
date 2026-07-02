import React from 'react'
import * as d3 from 'd3'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette, surface } from '../core/theme'
import { caption, clamp01, fmt, glowFilter, lerp, mathLabel, mulberry32, stagger, type G } from '../core/draw'

// A real 4-6-6-3 network with seeded weights: the forward pass, the loss, the
// backward pass, and one honest gradient step — every number on screen is
// actually computed, including the loss dropping after the update.

const SIZES = [4, 6, 6, 3]
const TARGET = 1
const ETA = 0.9

function buildNetwork() {
  const rand = mulberry32(1234)
  const W: number[][][] = [] // W[l][j][i]: layer l -> l+1
  for (let l = 0; l < SIZES.length - 1; l++) {
    W.push(
      Array.from({ length: SIZES[l + 1] }, () =>
        Array.from({ length: SIZES[l] }, () => (rand() * 2 - 1) * 1.1),
      ),
    )
  }
  const x = Array.from({ length: SIZES[0] }, () => 0.15 + rand() * 0.85)

  const forward = (Wf: number[][][]) => {
    const a: number[][] = [x]
    const z: number[][] = [x]
    for (let l = 0; l < Wf.length; l++) {
      const zl = Wf[l].map((row) => row.reduce((s, w, i) => s + w * a[l][i], 0))
      z.push(zl)
      a.push(l < Wf.length - 1 ? zl.map((v) => Math.max(0, v)) : zl)
    }
    const logits = a[a.length - 1]
    const m = Math.max(...logits)
    const exps = logits.map((v) => Math.exp(v - m))
    const Z = exps.reduce((s, v) => s + v, 0)
    const p = exps.map((v) => v / Z)
    const loss = -Math.log(Math.max(p[TARGET], 1e-9))
    return { a, z, p, loss }
  }

  const { a, z, p, loss } = forward(W)

  // backprop
  const L = W.length
  const deltas: number[][] = []
  let delta = p.map((v, j) => v - (j === TARGET ? 1 : 0))
  deltas[L - 1] = delta
  for (let l = L - 2; l >= 0; l--) {
    const next = Array.from({ length: SIZES[l + 1] }, (_, j) => {
      let s = 0
      for (let k = 0; k < SIZES[l + 2]; k++) s += W[l + 1][k][j] * delta[k]
      return z[l + 1][j] > 0 ? s : 0
    })
    delta = next
    deltas[l] = delta
  }
  const dW: number[][][] = W.map((Wl, l) =>
    Wl.map((row, j) => row.map((_, i) => deltas[l][j] * a[l][i])),
  )
  const W2 = W.map((Wl, l) => Wl.map((row, j) => row.map((w, i) => w - ETA * dW[l][j][i])))
  const after = forward(W2)

  return { W, W2, dW, a, p, loss, p2: after.p, loss2: after.loss }
}

const ACTS: Act[] = [
  {
    name: 'the network',
    duration: 3000,
    hold: 300,
    say: 'Here is a small neural network. Teal edges carry positive weights, pink ones negative — thickness is magnitude.',
  },
  {
    name: 'forward pass',
    duration: 4400,
    hold: 400,
    say: 'The forward pass. Activations flow left to right — each layer takes a weighted sum, then a ReLU.',
  },
  {
    name: 'prediction vs target',
    duration: 2600,
    hold: 500,
    say: 'Softmax turns the final scores into a belief. The target was dog. The loss measures exactly how wrong we are.',
  },
  {
    name: 'backpropagation',
    duration: 4400,
    hold: 400,
    say: 'Now the error flows backwards. Every single weight learns its own share of the blame.',
  },
  {
    name: 'one gradient step',
    duration: 2600,
    hold: 900,
    say: 'Take one gradient step, and the loss drops. Repeat a few million times, and the network has learned.',
  },
]

const CAPTIONS: Record<string, string> = {
  'the network': 'teal = positive weight, pink = negative — thickness is magnitude',
  'forward pass': 'activations flow left to right: a′ = ReLU(W a)',
  'prediction vs target': 'softmax turns scores into belief — the loss measures the miss',
  backpropagation: 'the error flows backwards: every weight learns its share of blame',
  'one gradient step': 'w ← w − η·∂L/∂w   …and the loss drops',
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  const net = buildNetwork()
  const glow = glowFilter(defs, 'nn-glow', 3)
  const root = svg.append('g') as G

  const xs = [150, 380, 610, 830]
  const nodeY = (l: number, i: number) => 268 - ((SIZES[l] - 1) * 58) / 2 + i * 58
  const maxW = Math.max(...net.W.flat(2).map(Math.abs))
  const maxG = Math.max(...net.dW.flat(2).map(Math.abs))

  const headers = ['input x', 'hidden · ReLU', 'hidden · ReLU', 'softmax ŷ']
  xs.forEach((x, l) =>
    mathLabel(root, { x, y: 64, text: headers[l], color: ink.secondary, size: 14, italic: false }),
  )

  // edges (one base line + one red gradient overlay each)
  type Edge = {
    l: number
    i: number
    j: number
    base: d3.Selection<SVGLineElement, unknown, null, undefined>
    over: d3.Selection<SVGLineElement, unknown, null, undefined>
    pulse: d3.Selection<SVGCircleElement, unknown, null, undefined>
    p1: [number, number]
    p2: [number, number]
  }
  const edges: Edge[] = []
  const edgeLayer = root.append('g') as G
  const overLayer = root.append('g') as G
  const pulseLayer = root.append('g') as G
  const widthFor = (w: number) => 0.6 + (2.6 * Math.abs(w)) / maxW
  const colorFor = (w: number) => (w >= 0 ? palette.teal : palette.pink)
  for (let l = 0; l < SIZES.length - 1; l++) {
    for (let j = 0; j < SIZES[l + 1]; j++) {
      for (let i = 0; i < SIZES[l]; i++) {
        const p1: [number, number] = [xs[l], nodeY(l, i)]
        const p2: [number, number] = [xs[l + 1], nodeY(l + 1, j)]
        const base = edgeLayer
          .append('line')
          .attr('x1', p1[0])
          .attr('y1', p1[1])
          .attr('x2', p2[0])
          .attr('y2', p2[1])
        const over = overLayer
          .append('line')
          .attr('x1', p1[0])
          .attr('y1', p1[1])
          .attr('x2', p2[0])
          .attr('y2', p2[1])
          .attr('stroke', palette.red)
          .attr('opacity', 0)
        const pulse = pulseLayer.append('circle').attr('r', 2.6).attr('opacity', 0)
        edges.push({ l, i, j, base, over, pulse, p1, p2 })
      }
    }
  }

  // nodes
  type Node = {
    l: number
    i: number
    value: number // activation, normalized per layer
    circle: d3.Selection<SVGCircleElement, unknown, null, undefined>
    fill: d3.Selection<SVGCircleElement, unknown, null, undefined>
  }
  const nodes: Node[] = []
  const nodeLayer = root.append('g') as G
  for (let l = 0; l < SIZES.length; l++) {
    const amax = Math.max(...net.a[l].map(Math.abs), 1e-9)
    for (let i = 0; i < SIZES[l]; i++) {
      const fill = nodeLayer
        .append('circle')
        .attr('cx', xs[l])
        .attr('cy', nodeY(l, i))
        .attr('r', 13)
        .attr('fill', palette.blue)
        .attr('opacity', 0)
      const circle = nodeLayer
        .append('circle')
        .attr('cx', xs[l])
        .attr('cy', nodeY(l, i))
        .attr('r', 13)
        .attr('fill', surface)
        .attr('fill-opacity', 0.001)
        .attr('stroke', ink.axis)
        .attr('stroke-width', 1.5)
        .attr('opacity', 0)
      nodes.push({ l, i, value: net.a[l][i] / amax, circle, fill })
    }
  }
  // paint order: rings above fills — swap so fill sits on top of ring's fill
  nodes.forEach((n) => n.fill.raise())

  // softmax bars + target + loss
  const out = root.append('g') as G
  const classNames = ['cat', 'dog', 'ship']
  const bars = d3.range(SIZES[3]).map((j) => {
    const y = nodeY(3, j)
    out
      .append('text')
      .attr('x', 862)
      .attr('y', y + 4)
      .attr('fill', j === TARGET ? palette.green : ink.secondary)
      .attr('font-size', 13)
      .attr('font-family', 'sans-serif')
      .text(classNames[j])
    return out
      .append('rect')
      .attr('x', 895)
      .attr('y', y - 7)
      .attr('height', 14)
      .attr('rx', 3)
      .attr('width', 0)
      .attr('fill', j === TARGET ? palette.green : palette.blue)
  })
  const targetTick = out
    .append('text')
    .attr('x', 862)
    .attr('y', nodeY(3, TARGET) - 16)
    .attr('fill', palette.green)
    .attr('font-size', 12)
    .attr('font-family', 'sans-serif')
    .attr('opacity', 0)
    .text('▲ target')
  const lossLab = mathLabel(root, { x: 470, y: 500, text: '', color: palette.red, size: 21, mono: true })
  lossLab.attr('opacity', 0)

  const cap = caption(root, { x: width / 2, y: height - 14, text: '', size: 15 })

  const hash = (e: Edge) => ((e.i * 7 + e.j * 13) % 10) / 10

  return (s: Sample) => {
    const pBuild = phase(tl, s, 'the network')
    const pFwd = phase(tl, s, 'forward pass')
    const pPred = phase(tl, s, 'prediction vs target')
    const pBack = phase(tl, s, 'backpropagation')
    const pStep = phase(tl, s, 'one gradient step')

    // build: nodes by layer, then edges by block
    for (const n of nodes) {
      const t = stagger(pBuild, n.l * 6 + n.i, 24, 0.85)
      n.circle.attr('opacity', t)
    }

    // one honest step: weights interpolate to their updated values
    for (const e of edges) {
      const w = lerp(net.W[e.l][e.j][e.i], net.W2[e.l][e.j][e.i], pStep)
      const t = stagger(pBuild, e.l, 3, 0.5)
      e.base
        .attr('stroke', colorFor(w))
        .attr('stroke-width', widthFor(w))
        .attr('opacity', t * (0.13 + (0.4 * Math.abs(w)) / maxW))
    }

    // forward: 3 blocks of pulses, layer lights up as its block completes
    const seg = pFwd * 3
    for (const e of edges) {
      const local = clamp01(seg - e.l - hash(e) * 0.25)
      const tPulse = clamp01(local * 1.4)
      const on = pFwd > 0 && local > 0 && local < 1 && tPulse < 1
      e.pulse
        .attr('fill', palette.blue)
        .attr('cx', lerp(e.p1[0], e.p2[0], tPulse))
        .attr('cy', lerp(e.p1[1], e.p2[1], tPulse))
        .attr('opacity', on ? 0.9 * Math.sin(Math.PI * tPulse) : 0)
        .attr('filter', on ? glow : null)
    }
    for (const n of nodes) {
      const lit = n.l === 0 ? clamp01(seg * 4) : clamp01((seg - n.l + 0.15) * 4)
      n.fill.attr('opacity', pFwd > 0 ? lit * 0.85 * n.value : 0)
    }

    // prediction: bars grow to real softmax p (then step to p2)
    for (let j = 0; j < bars.length; j++) {
      const pj = lerp(net.p[j], net.p2[j], pStep)
      bars[j].attr('width', pPred * pj * 104)
    }
    targetTick.attr('opacity', pPred)
    // count up to the true loss during the reveal, then track the step honestly
    const displayLoss = pStep > 0 ? lerp(net.loss, net.loss2, pStep) : net.loss * Math.min(pPred * 1.4, 1)
    lossLab.text(`loss = ${fmt(displayLoss, 3)}`).attr('opacity', pPred)

    // backward: red flows right-to-left, edges tinted by their true |gradient|
    const bseg = pBack * 3
    for (const e of edges) {
      const bl = 2 - e.l // reversed block order
      const local = clamp01(bseg - bl - hash(e) * 0.25)
      const tPulse = clamp01(local * 1.4)
      const gmag = Math.abs(net.dW[e.l][e.j][e.i]) / maxG
      if (pBack > 0 && local > 0 && tPulse < 1 && pStep === 0) {
        e.pulse
          .attr('fill', palette.red)
          .attr('cx', lerp(e.p2[0], e.p1[0], tPulse))
          .attr('cy', lerp(e.p2[1], e.p1[1], tPulse))
          .attr('opacity', 0.9 * Math.sin(Math.PI * tPulse) * clamp01(gmag * 3))
      }
      e.over.attr('stroke-width', 0.5 + gmag * 3).attr('opacity', pBack * (1 - pStep) * gmag * 0.55)
    }

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'neural-network',
  title: 'Forward, backward, step — one round of learning',
  summary: 'Real forward pass, softmax loss, backprop blame, one honest gradient step.',
  acts: ACTS,
  setup,
}

export function NeuralNetwork() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
