import React from 'react'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { arrowMarker, caption, clamp01, lerp, mathLabel, stagger, type G } from '../core/draw'

// A ring of unit vectors hit by M = [[2,1],[1,2]]. Almost all of them turn —
// except the two eigendirections (1,1)/√2 (λ=3) and (1,−1)/√2 (λ=1). The
// finale is power iteration: M^t applied continuously (M^t = V·diag(λ^t)·Vᵀ
// in closed form for a symmetric matrix) collapses every direction onto the
// dominant eigenvector.

const M = { a: 2, b: 1, c: 1, d: 2 }
const L1 = 3 // eigenvalue along (1,1)/√2
const L2 = 1 // eigenvalue along (1,−1)/√2
const S2 = Math.SQRT1_2

const N_SPOKES = 16
const EIG1 = [2, 10] // spoke indices at 45°, 225°
const EIG2 = [6, 14] // 135°, 315°

const ACTS: Act[] = [
  {
    name: 'a ring of vectors',
    duration: 2600,
    hold: 300,
    say: 'Take a whole ring of unit vectors, pointing in every direction.',
  },
  {
    name: 'transform them all',
    duration: 3800,
    hold: 500,
    say: 'Now hit every one of them with the matrix M. Almost every vector gets knocked off its own direction.',
  },
  {
    name: 'two directions survive',
    duration: 3000,
    hold: 600,
    say: 'But look. Two directions never turned. Vectors on these lines only stretched. These are the eigenvectors.',
  },
  {
    name: 'they only scale',
    duration: 3600,
    hold: 500,
    say: 'Along the first line, everything scales by exactly three. Along the second, by exactly one. Those factors are the eigenvalues.',
  },
  {
    name: 'repeat M: power iteration',
    duration: 4600,
    hold: 900,
    say: 'Now apply M again, and again. Every direction in the plane collapses onto the dominant eigenvector. This is power iteration — it is how PageRank finds the web’s most important pages.',
  },
]

const CAPTIONS: Record<string, string> = {
  'a ring of vectors': 'unit vectors in every direction',
  'transform them all': 'v → Mv — almost everything turns',
  'two directions survive': 'Mv ∥ v — the eigenvectors',
  'they only scale': 'Mv = λv:   λ₁ = 3,   λ₂ = 1',
  'repeat M: power iteration': 'Mᵏv → dominant eigendirection (power iteration, PageRank, PCA)',
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  const unit = 80
  const cx = width / 2
  const cy = height / 2 - 6
  const X = (x: number) => cx + x * unit
  const Y = (y: number) => cy - y * unit

  const mul = (x: number, y: number): [number, number] => [M.a * x + M.c * y, M.b * x + M.d * y]
  // closed-form matrix power for symmetric M: coords in eigenbasis scale by λ^k
  const powerApply = (x: number, y: number, k: number): [number, number] => {
    const c1 = (x + y) * S2
    const c2 = (x - y) * S2
    const s1 = c1 * Math.pow(L1, k)
    const s2 = c2 * Math.pow(L2, k)
    return [(s1 + s2) * S2, (s1 - s2) * S2]
  }

  const root = svg.append('g') as G

  // recessive grid
  const grid = root.append('g') as G
  for (let k = -6; k <= 6; k++) {
    grid.append('line').attr('x1', X(k)).attr('x2', X(k)).attr('y1', Y(-3.4)).attr('y2', Y(3.4))
    grid.append('line').attr('y1', Y(k)).attr('y2', Y(k)).attr('x1', X(-6)).attr('x2', X(6))
  }
  grid.selectAll('line').attr('stroke', ink.grid)

  // eigenlines (dashed, through origin)
  const eigLine1 = root
    .append('line')
    .attr('x1', X(-3.2))
    .attr('y1', Y(-3.2))
    .attr('x2', X(3.2))
    .attr('y2', Y(3.2))
    .attr('stroke', palette.yellow)
    .attr('stroke-dasharray', '6,7')
    .attr('stroke-width', 1.2)
  const eigLine2 = root
    .append('line')
    .attr('x1', X(-3.2))
    .attr('y1', Y(3.2))
    .attr('x2', X(3.2))
    .attr('y2', Y(-3.2))
    .attr('stroke', palette.teal)
    .attr('stroke-dasharray', '6,7')
    .attr('stroke-width', 1.2)

  // spokes
  const arrows = {
    plain: arrowMarker(defs, 'ev-a-plain', palette.blue, 4.5),
    e1: arrowMarker(defs, 'ev-a-e1', palette.yellow, 4.5),
    e2: arrowMarker(defs, 'ev-a-e2', palette.teal, 4.5),
  }
  type Spoke = {
    i: number
    ux: number
    uy: number
    kind: 'plain' | 'e1' | 'e2'
    el: SVGLineElement
  }
  const spokes: Spoke[] = []
  for (let i = 0; i < N_SPOKES; i++) {
    const th = (i / N_SPOKES) * 2 * Math.PI
    const kind: Spoke['kind'] = EIG1.includes(i) ? 'e1' : EIG2.includes(i) ? 'e2' : 'plain'
    const color = kind === 'e1' ? palette.yellow : kind === 'e2' ? palette.teal : palette.blue
    const el = root
      .append('line')
      .attr('stroke', color)
      .attr('stroke-width', kind === 'plain' ? 2 : 3)
      .attr('marker-end', arrows[kind])
      .node()!
    spokes.push({ i, ux: Math.cos(th), uy: Math.sin(th), kind, el })
  }

  // matrix + eigenvalue readouts
  mathLabel(root, { x: 34, y: 46, text: 'M = [ 2 1 ; 1 2 ]', color: ink.secondary, size: 17, anchor: 'start', mono: true })
  const l1Lab = mathLabel(root, { x: 0, y: 0, text: 'λ₁ = 3', color: palette.yellow, size: 19 })
  const l2Lab = mathLabel(root, { x: 0, y: 0, text: 'λ₂ = 1', color: palette.teal, size: 19 })
  const cap = caption(root, { x: width / 2, y: height - 18, text: '', size: 16 })

  return (s: Sample) => {
    const pRing = phase(tl, s, 'a ring of vectors')
    const pXform = phase(tl, s, 'transform them all')
    const pSurvive = phase(tl, s, 'two directions survive')
    const pScale = phase(tl, s, 'they only scale')
    const pPower = phase(tl, s, 'repeat M: power iteration')

    for (const sp of spokes) {
      const grow = stagger(pRing, sp.i, N_SPOKES, 0.85)
      let [x, y] = [sp.ux, sp.uy]

      // act 2: everyone gets transformed
      const [mx, my] = mul(sp.ux, sp.uy)
      x = lerp(sp.ux, mx, pXform)
      y = lerp(sp.uy, my, pXform)

      // act 4: eigen spokes pulse 1 → λ → 1 → λ (cos(3π·t) ends stretched)
      if (pScale > 0 && sp.kind !== 'plain') {
        const lam = sp.kind === 'e1' ? L1 : L2
        const f = 1 + (lam - 1) * (0.5 - 0.5 * Math.cos(3 * Math.PI * pScale))
        x = sp.ux * f
        y = sp.uy * f
      }

      // act 5: rewind (first 20%), then continuous power M^k, normalized to length 2
      if (pPower > 0) {
        if (pPower < 0.2) {
          const back = pPower / 0.2
          const lam = sp.kind === 'e1' ? L1 : sp.kind === 'e2' ? L2 : 1
          const [fx, fy] = sp.kind === 'plain' ? [mx, my] : [sp.ux * lam, sp.uy * lam]
          x = lerp(fx, sp.ux, back)
          y = lerp(fy, sp.uy, back)
        } else {
          const k = ((pPower - 0.2) / 0.8) * 4
          const [px, py] = powerApply(sp.ux, sp.uy, k)
          const n = Math.hypot(px, py) || 1
          x = (px / n) * 2
          y = (py / n) * 2
        }
      }

      // plain spokes dim while the eigenvectors take the stage, then come back for power iteration
      const opacity = grow * (sp.kind === 'plain' ? (pPower > 0.2 ? 0.7 : lerp(1, 0.15, clamp01(pSurvive * 2))) : 1)
      sp.el.setAttribute('x1', String(X(0)))
      sp.el.setAttribute('y1', String(Y(0)))
      sp.el.setAttribute('x2', String(X(x * grow)))
      sp.el.setAttribute('y2', String(Y(y * grow)))
      sp.el.setAttribute('opacity', String(opacity))
    }

    eigLine1.attr('opacity', pSurvive * 0.7)
    eigLine2.attr('opacity', pSurvive * 0.7)
    l1Lab
      .attr('x', X(2.35 * S2 * L1 * 0.55))
      .attr('y', Y(2.35 * S2 * L1 * 0.55) - 14)
      .attr('opacity', pScale)
    l2Lab
      .attr('x', X(-1.7 * S2) - 26)
      .attr('y', Y(1.7 * S2) - 10)
      .attr('opacity', pScale)

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'eigenvectors',
  title: 'Eigenvectors — the directions a matrix cannot turn',
  summary: 'A ring of vectors hit by M — two directions never turn; finale is power iteration (PageRank).',
  acts: ACTS,
  setup,
}

export function Eigenvectors() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
