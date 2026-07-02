import React from 'react'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { caption, clamp01, fmt, lerp, mathLabel, type G } from '../core/draw'

// Every matrix is rotate → stretch → rotate: M = U·Σ·Vᵀ. The SVD of a 2×2 is
// computed in closed form at setup (eigendecomposition of MᵀM), and the acts
// apply Vᵀ, then Σ, then U — ending with the exact image of M overlaid as
// proof that the three motions compose back to the original transform.

const M = { a: 1, b: 0.6, c: -0.8, d: 1.1 } // det = 1.58 > 0, so U and V are rotations

function computeSVD() {
  const { a, b, c, d } = M
  // MᵀM = [[a²+b², ac+bd], [ac+bd, c²+d²]]
  const p = a * a + b * b
  const q = a * c + b * d
  const r = c * c + d * d
  const tr = p + r
  const det = p * r - q * q
  const disc = Math.sqrt(Math.max(tr * tr - 4 * det, 0))
  const l1 = (tr + disc) / 2
  const l2 = (tr - disc) / 2
  const s1 = Math.sqrt(l1)
  const s2 = Math.sqrt(l2)
  // dominant eigenvector of MᵀM → first right-singular vector
  let v1: [number, number] = Math.abs(q) > 1e-12 ? [q, l1 - p] : [1, 0]
  const n1 = Math.hypot(v1[0], v1[1])
  v1 = [v1[0] / n1, v1[1] / n1]
  const thetaV = Math.atan2(v1[1], v1[0])
  // u1 = M·v1 / σ1
  const u1: [number, number] = [(a * v1[0] + c * v1[1]) / s1, (b * v1[0] + d * v1[1]) / s1]
  const thetaU = Math.atan2(u1[1], u1[0])
  return { s1, s2, thetaV, thetaU }
}

const ACTS: Act[] = [
  {
    name: 'any matrix',
    duration: 3400,
    hold: 300,
    say: 'Here is an arbitrary matrix — it skews, rotates and stretches all at once. It looks like one tangled motion.',
  },
  {
    name: 'first: rotate',
    duration: 3000,
    hold: 400,
    say: 'But watch. Step one is nothing but a rotation — that is V transpose.',
  },
  {
    name: 'then: stretch',
    duration: 3200,
    hold: 500,
    say: 'Step two stretches along the axes, and only along the axes. The stretch factors are the singular values.',
  },
  {
    name: 'finally: rotate again',
    duration: 3000,
    hold: 400,
    say: 'And step three is one more rotation — that is U.',
  },
  {
    name: 'M = U Σ Vᵀ',
    duration: 2800,
    hold: 1000,
    say: 'Rotate, stretch, rotate. The dashed outline is the original matrix applied directly — a perfect match. Every matrix, no exceptions, is just these three motions. That is the singular value decomposition.',
  },
]

const CAPTIONS: Record<string, string> = {
  'any matrix': 'M — a skew, a rotation and a stretch, tangled together',
  'first: rotate': 'Vᵀ — a pure rotation',
  'then: stretch': 'Σ — a pure axis-aligned stretch (σ₁, σ₂)',
  'finally: rotate again': 'U — one more pure rotation',
  'M = U Σ Vᵀ': 'the dashed outline is M applied directly — identical',
}

type Mat2 = [number, number, number, number] // column-major [a, b, c, d]
const matMul = (m: Mat2, n: Mat2): Mat2 => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
]
const rot = (th: number): Mat2 => [Math.cos(th), Math.sin(th), -Math.sin(th), Math.cos(th)]
const diag = (x: number, y: number): Mat2 => [x, 0, 0, y]
const apply = (m: Mat2, x: number, y: number): [number, number] => [m[0] * x + m[2] * y, m[1] * x + m[3] * y]

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  void defs
  const svd = computeSVD()
  const unit = 92
  const cx = width / 2
  const cy = height / 2 - 4
  const X = (x: number) => cx + x * unit
  const Y = (y: number) => cy - y * unit
  const MM: Mat2 = [M.a, M.b, M.c, M.d]

  const root = svg.append('g') as G

  // static reference grid
  const ref = root.append('g') as G
  for (let k = -6; k <= 6; k++) {
    ref.append('line').attr('x1', X(k)).attr('x2', X(k)).attr('y1', Y(-3.2)).attr('y2', Y(3.2))
    ref.append('line').attr('y1', Y(k)).attr('y2', Y(k)).attr('x1', X(-6)).attr('x2', X(6))
  }
  ref.selectAll('line').attr('stroke', ink.grid)

  // moving grid
  type Seg = { p1: [number, number]; p2: [number, number]; axis: boolean; el: SVGLineElement }
  const segs: Seg[] = []
  const movingLayer = root.append('g') as G
  for (let k = -6; k <= 6; k++) {
    for (const horiz of [false, true]) {
      const p1: [number, number] = horiz ? [-6, k] : [k, -3.5]
      const p2: [number, number] = horiz ? [6, k] : [k, 3.5]
      const el = movingLayer
        .append('line')
        .attr('stroke', palette.blue)
        .attr('stroke-width', k === 0 ? 1.5 : 1)
        .node()!
      segs.push({ p1, p2, axis: k === 0, el })
    }
  }

  // the unit circle (image becomes the singular ellipse)
  const CIRCLE_N = 72
  const circle = root.append('path').attr('fill', palette.teal).attr('fill-opacity', 0.08).attr('stroke', palette.teal).attr('stroke-width', 2)
  // ghost: exact image under M, shown in the finale
  const ghost = root
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', palette.green)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '7,7')
  {
    let d = ''
    for (let i = 0; i <= CIRCLE_N; i++) {
      const th = (i / CIRCLE_N) * 2 * Math.PI
      const [x, y] = apply(MM, Math.cos(th), Math.sin(th))
      d += (i === 0 ? 'M' : 'L') + X(x).toFixed(1) + ',' + Y(y).toFixed(1)
    }
    ghost.attr('d', d).attr('opacity', 0)
  }

  // singular-axis arrows + labels (appear during the stretch)
  const ax1 = root.append('line').attr('stroke', palette.gold).attr('stroke-width', 3)
  const ax2 = root.append('line').attr('stroke', palette.gold).attr('stroke-width', 3)
  const s1Lab = mathLabel(root, { x: 0, y: 0, text: `σ₁ = ${fmt(svd.s1)}`, color: palette.gold, size: 17 })
  const s2Lab = mathLabel(root, { x: 0, y: 0, text: `σ₂ = ${fmt(svd.s2)}`, color: palette.gold, size: 17 })

  const stageLab = mathLabel(root, { x: 34, y: 46, text: '', color: ink.primary, size: 20, anchor: 'start' })
  const cap = caption(root, { x: width / 2, y: height - 18, text: '', size: 16 })

  const STAGE_TEXT: Record<string, string> = {
    'any matrix': 'M',
    'first: rotate': 'Vᵀ',
    'then: stretch': 'Σ · Vᵀ',
    'finally: rotate again': 'U · Σ · Vᵀ',
    'M = U Σ Vᵀ': 'M = U Σ Vᵀ ✓',
  }

  return (s: Sample) => {
    const pIntro = phase(tl, s, 'any matrix')
    const pV = phase(tl, s, 'first: rotate')
    const pS = phase(tl, s, 'then: stretch')
    const pU = phase(tl, s, 'finally: rotate again')
    const pDone = phase(tl, s, 'M = U Σ Vᵀ')

    // intro: morph to M and back (0→0.5 forward, 0.55→1 rewind)
    let A: Mat2
    if (pV === 0) {
      const f = pIntro < 0.5 ? pIntro / 0.5 : pIntro < 0.62 ? 1 : 1 - (pIntro - 0.62) / 0.38
      A = [lerp(1, MM[0], f), lerp(0, MM[1], f), lerp(0, MM[2], f), lerp(1, MM[3], f)]
    } else {
      // staged composition
      const Vt = rot(-svd.thetaV * pV)
      const S = diag(lerp(1, svd.s1, pS), lerp(1, svd.s2, pS))
      const U = rot(svd.thetaU * pU)
      A = matMul(U, matMul(S, Vt))
    }

    for (const seg of segs) {
      const [x1, y1] = apply(A, seg.p1[0], seg.p1[1])
      const [x2, y2] = apply(A, seg.p2[0], seg.p2[1])
      seg.el.setAttribute('x1', String(X(x1)))
      seg.el.setAttribute('y1', String(Y(y1)))
      seg.el.setAttribute('x2', String(X(x2)))
      seg.el.setAttribute('y2', String(Y(y2)))
      seg.el.setAttribute('opacity', String(seg.axis ? 0.5 : 0.18))
    }

    let d = ''
    for (let i = 0; i <= CIRCLE_N; i++) {
      const th = (i / CIRCLE_N) * 2 * Math.PI
      const [x, y] = apply(A, Math.cos(th), Math.sin(th))
      d += (i === 0 ? 'M' : 'L') + X(x).toFixed(1) + ',' + Y(y).toFixed(1)
    }
    circle.attr('d', d)

    // singular axes ride the current transform of v1 / v2 directions
    const stretchOn = clamp01(pS * 2) * (1 - 0) // visible from the stretch act on
    const v1: [number, number] = [Math.cos(svd.thetaV), Math.sin(svd.thetaV)]
    const v2: [number, number] = [-Math.sin(svd.thetaV), Math.cos(svd.thetaV)]
    const [a1x, a1y] = apply(A, v1[0], v1[1])
    const [a2x, a2y] = apply(A, v2[0], v2[1])
    ax1.attr('x1', X(0)).attr('y1', Y(0)).attr('x2', X(a1x)).attr('y2', Y(a1y)).attr('opacity', stretchOn * 0.9)
    ax2.attr('x1', X(0)).attr('y1', Y(0)).attr('x2', X(a2x)).attr('y2', Y(a2y)).attr('opacity', stretchOn * 0.9)
    s1Lab.attr('x', X(a1x * 1.16)).attr('y', Y(a1y * 1.16)).attr('opacity', stretchOn)
    s2Lab.attr('x', X(a2x * 1.24)).attr('y', Y(a2y * 1.24)).attr('opacity', stretchOn)

    ghost.attr('opacity', pDone * 0.9)
    stageLab.text(STAGE_TEXT[s.name] ?? '')

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'svd-decomposition',
  title: 'SVD — every matrix is rotate · stretch · rotate',
  summary: 'Every matrix staged as rotate → stretch → rotate (M = U·Σ·Vᵀ), with proof overlay.',
  acts: ACTS,
  setup,
}

export function SVDDecomposition() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
