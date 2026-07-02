import React, { useMemo } from 'react'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { arrowMarker, caption, clamp01, fmt, lerp, mathLabel, stagger, type G } from '../core/draw'

// The 3b1b classic: a matrix is where the basis vectors land, and the whole
// plane follows. Parameterized by the matrix, so stories can show shears,
// rotations, and a singular collapse with the same machinery.

export interface Mat {
  a: number
  b: number
  c: number
  d: number
}

const DEFAULT_M: Mat = { a: 1, b: 0.6, c: -0.8, d: 1.1 }
const V = { x: 2, y: 1 }

function makeActs(det: number): Act[] {
  const singular = Math.abs(det) < 0.01
  return [
    {
      name: 'the plane',
      duration: 2600,
      hold: 300,
      say: 'Think of space as a sheet of graph paper, woven from two threads: the basis vectors i-hat and j-hat.',
    },
    {
      name: 'a matrix moves space',
      duration: 4200,
      hold: 700,
      say: 'A matrix is nothing more than an instruction for where those two basis vectors land. Every gridline follows them.',
    },
    { name: 'rewind', duration: 1400, say: 'Rewind for a moment.' },
    {
      name: 'meet a vector',
      duration: 2200,
      hold: 500,
      say: 'Here is a vector v: two steps along i-hat, one step along j-hat. Just a recipe in the basis.',
    },
    {
      name: 'v rides along',
      duration: 4200,
      hold: 700,
      say: 'Transform again, and watch: the recipe survives. M v is two copies of where i-hat went, plus one copy of where j-hat went.',
    },
    {
      name: 'determinant',
      duration: 3200,
      hold: 900,
      say: singular
        ? 'And the determinant is zero: the unit square is crushed flat. The whole plane collapses onto a line — a dimension is lost.'
        : `And the determinant, ${det.toFixed(2)}, is simply the factor by which every area gets scaled.`,
    },
  ]
}

function makeCaptions(det: number): Record<string, string> {
  const singular = Math.abs(det) < 0.01
  return {
    'the plane': 'space is a sheet of graph paper — î and ĵ are its threads',
    'a matrix moves space': 'a matrix is nothing but where î and ĵ land',
    rewind: '',
    'meet a vector': 'v = 2î + 1ĵ — a recipe in the basis',
    'v rides along': 'the recipe is preserved:  Mv = 2·(Mî) + 1·(Mĵ)',
    determinant: singular
      ? 'det M = 0 — the plane collapses onto a line; a dimension is lost'
      : 'det M = the factor by which every area is scaled',
  }
}

function makeSetup(M: Mat, DET: number) {
  return function setup({ svg, defs, width, height, tl }: SceneCtx) {
    const unit = 90
    const cx = width / 2
    const cy = height / 2
    const X = (x: number) => cx + x * unit
    const Y = (y: number) => cy - y * unit

    const I: Mat = { a: 1, b: 0, c: 0, d: 1 }
    const mul = (m: Mat, x: number, y: number): [number, number] => [m.a * x + m.c * y, m.b * x + m.d * y]
    const lerpMat = (m0: Mat, m1: Mat, t: number): Mat => ({
      a: lerp(m0.a, m1.a, t),
      b: lerp(m0.b, m1.b, t),
      c: lerp(m0.c, m1.c, t),
      d: lerp(m0.d, m1.d, t),
    })

    const CAPTIONS = makeCaptions(DET)
    const root = svg.append('g') as G

    // static reference grid (stays put, very recessive)
    const ref = root.append('g') as G
    for (let k = -6; k <= 6; k++) {
      ref.append('line').attr('x1', X(k)).attr('x2', X(k)).attr('y1', Y(-4)).attr('y2', Y(4))
      ref.append('line').attr('y1', Y(k)).attr('y2', Y(k)).attr('x1', X(-6)).attr('x2', X(6))
    }
    ref.selectAll('line').attr('stroke', ink.grid).attr('stroke-width', 1)

    // the moving grid: endpoints in math coords, transformed per frame
    const movingLayer = root.append('g') as G
    type Seg = { p1: [number, number]; p2: [number, number]; axis: boolean; el: SVGLineElement; i: number }
    const segs: Seg[] = []
    let si = 0
    for (let k = -6; k <= 6; k++) {
      for (const horiz of [false, true]) {
        const p1: [number, number] = horiz ? [-6, k] : [k, -4]
        const p2: [number, number] = horiz ? [6, k] : [k, 4]
        const axis = k === 0
        const el = movingLayer
          .append('line')
          .attr('stroke', palette.blue)
          .attr('stroke-width', axis ? 1.6 : 1)
          .node()!
        segs.push({ p1, p2, axis, el, i: si++ })
      }
    }

    // determinant parallelogram (unit square carried by the transform)
    const para = root
      .append('polygon')
      .attr('fill', palette.teal)
      .attr('stroke', palette.teal)
      .attr('stroke-width', 1)

    // basis vectors + labels
    const arrowBlue = arrowMarker(defs, 'lt-arrow-blue', palette.blue)
    const arrowYellow = arrowMarker(defs, 'lt-arrow-yellow', palette.yellow)
    const arrowGreen = arrowMarker(defs, 'lt-arrow-green', palette.green)
    const iVec = root.append('line').attr('stroke', palette.blue).attr('stroke-width', 3.5).attr('marker-end', arrowBlue)
    const jVec = root.append('line').attr('stroke', palette.yellow).attr('stroke-width', 3.5).attr('marker-end', arrowYellow)
    const iLab = mathLabel(root, { x: 0, y: 0, text: 'î', color: palette.blue, size: 24 })
    const jLab = mathLabel(root, { x: 0, y: 0, text: 'ĵ', color: palette.yellow, size: 24 })

    // the passenger vector v, its ghost, and its basis recipe
    const ghost = root
      .append('line')
      .attr('stroke', palette.green)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,6')
    const comp1 = root.append('line').attr('stroke', palette.blue).attr('stroke-width', 1.6).attr('stroke-dasharray', '4,5')
    const comp2 = root.append('line').attr('stroke', palette.yellow).attr('stroke-width', 1.6).attr('stroke-dasharray', '4,5')
    const vVec = root.append('line').attr('stroke', palette.green).attr('stroke-width', 4).attr('marker-end', arrowGreen)
    const vLab = mathLabel(root, { x: 0, y: 0, text: 'v', color: palette.green, size: 24 })

    // matrix readout, top-left: [ a  c ; b  d ] with columns in basis colors
    const panel = root.append('g').attr('transform', 'translate(30, 34)') as G
    panel
      .append('rect')
      .attr('x', -12)
      .attr('y', -18)
      .attr('width', 344)
      .attr('height', 96)
      .attr('rx', 10)
      .attr('fill', '#0a0d15')
      .attr('opacity', 0.85)
    mathLabel(panel, { x: 8, y: 34, text: 'M =', color: ink.primary, size: 22, anchor: 'start' })
    // brackets
    panel.append('path').attr('d', 'M70,-2 h-8 v64 h8').attr('stroke', ink.secondary).attr('fill', 'none').attr('stroke-width', 1.5)
    panel.append('path').attr('d', 'M204,-2 h8 v64 h-8').attr('stroke', ink.secondary).attr('fill', 'none').attr('stroke-width', 1.5)
    const mA = mathLabel(panel, { x: 104, y: 20, text: '', color: palette.blue, size: 19, mono: true })
    const mB = mathLabel(panel, { x: 104, y: 50, text: '', color: palette.blue, size: 19, mono: true })
    const mC = mathLabel(panel, { x: 172, y: 20, text: '', color: palette.yellow, size: 19, mono: true })
    const mD = mathLabel(panel, { x: 172, y: 50, text: '', color: palette.yellow, size: 19, mono: true })
    const detLab = mathLabel(panel, { x: 224, y: 34, text: '', color: palette.gold, size: 15, anchor: 'start', mono: true })

    // area label pinned to the parallelogram
    const areaLab = mathLabel(root, { x: 0, y: 0, text: '', color: palette.teal, size: 17 })

    const cap = caption(root, { x: width / 2, y: height - 18, text: '', size: 16 })

    return (s: Sample) => {
      const pPlane = phase(tl, s, 'the plane')
      const pXform = phase(tl, s, 'a matrix moves space')
      const pRewind = phase(tl, s, 'rewind')
      const pVec = phase(tl, s, 'meet a vector')
      const pRide = phase(tl, s, 'v rides along')
      const pDet = phase(tl, s, 'determinant')

      // current matrix: forward, rewound, then forward again with v aboard
      let m = lerpMat(I, M, pXform)
      if (pRewind > 0) m = lerpMat(M, I, pRewind)
      if (pRide > 0) m = lerpMat(I, M, pRide)

      // moving grid — staggered reveal in act 1, transformed thereafter
      for (const seg of segs) {
        const t = stagger(pPlane, seg.i, segs.length, 0.92)
        const [x1, y1] = mul(m, seg.p1[0], seg.p1[1])
        const [x2, y2] = mul(m, seg.p2[0], seg.p2[1])
        seg.el.setAttribute('x1', String(X(x1)))
        seg.el.setAttribute('y1', String(Y(y1)))
        seg.el.setAttribute('x2', String(X(x2)))
        seg.el.setAttribute('y2', String(Y(y2)))
        seg.el.setAttribute('opacity', String(t * (seg.axis ? 0.55 : 0.22)))
      }

      // basis vectors ride the same matrix
      const [ix, iy] = mul(m, 1, 0)
      const [jx, jy] = mul(m, 0, 1)
      const grow = clamp01(pPlane * 1.6 - 0.4)
      iVec.attr('x1', X(0)).attr('y1', Y(0)).attr('x2', X(ix * grow)).attr('y2', Y(iy * grow)).attr('opacity', grow > 0.02 ? 1 : 0)
      jVec.attr('x1', X(0)).attr('y1', Y(0)).attr('x2', X(jx * grow)).attr('y2', Y(jy * grow)).attr('opacity', grow > 0.02 ? 1 : 0)
      iLab.attr('x', X(ix * 1.12 + 0.14)).attr('y', Y(iy * 1.12) + 8).attr('opacity', grow)
      jLab.attr('x', X(jx * 1.12 - 0.14)).attr('y', Y(jy * 1.12) - 6).attr('opacity', grow)

      // determinant parallelogram
      const [px, py] = [ix + jx, iy + jy]
      para
        .attr('points', `${X(0)},${Y(0)} ${X(ix)},${Y(iy)} ${X(px)},${Y(py)} ${X(jx)},${Y(jy)}`)
        .attr('fill-opacity', grow * (0.07 + 0.16 * pDet))
        .attr('stroke-opacity', grow * (0.25 + 0.5 * pDet))
      areaLab
        .attr('x', X((ix + jx) / 2))
        .attr('y', Y((iy + jy) / 2) - 12)
        .attr('opacity', pDet)
        .text(`area × ${fmt(Math.abs(DET))}`)

      // the passenger vector
      const vOn = pVec
      const [vx, vy] = mul(m, V.x, V.y)
      vVec
        .attr('x1', X(0))
        .attr('y1', Y(0))
        .attr('x2', X(vx * vOn))
        .attr('y2', Y(vy * vOn))
        .attr('opacity', vOn > 0.02 ? 1 : 0)
      vLab
        .attr('x', X(vx * 1.1 + 0.15))
        .attr('y', Y(vy * 1.1) - 6)
        .attr('opacity', vOn)
        .text(pRide > 0.02 ? 'Mv' : 'v')
      // recipe: 2î then 1ĵ, drawn in the *current* basis (the recipe survives M)
      comp1
        .attr('x1', X(0))
        .attr('y1', Y(0))
        .attr('x2', X(ix * 2 * vOn))
        .attr('y2', Y(iy * 2 * vOn))
        .attr('opacity', vOn * 0.7)
      comp2
        .attr('x1', X(ix * 2))
        .attr('y1', Y(iy * 2))
        .attr('x2', X(ix * 2 + jx * vOn))
        .attr('y2', Y(iy * 2 + jy * vOn))
        .attr('opacity', vOn > 0.9 ? 0.7 : 0)
      // ghost of where v started
      ghost
        .attr('x1', X(0))
        .attr('y1', Y(0))
        .attr('x2', X(V.x))
        .attr('y2', Y(V.y))
        .attr('opacity', pRide > 0.02 ? 0.3 : 0)

      // live matrix readout
      const panelOn = clamp01(pXform * 3)
      panel.attr('opacity', panelOn)
      mA.text(fmt(m.a))
      mB.text(fmt(m.b))
      mC.text(fmt(m.c))
      mD.text(fmt(m.d))
      detLab.text(`det = ${fmt(m.a * m.d - m.b * m.c)}`).attr('opacity', 0.4 + 0.6 * pDet)

      // caption crossfade at act boundaries
      const text = CAPTIONS[s.name] ?? ''
      cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
    }
  }
}

function makeDefinition(id: string, title: string, summary: string, matrix: Mat): VizDefinition {
  const det = matrix.a * matrix.d - matrix.b * matrix.c
  return { id, title, summary, acts: makeActs(det), setup: makeSetup(matrix, det) }
}

export const definitions: VizDefinition[] = [
  makeDefinition(
    'linear-transformation',
    'A matrix moves space',
    'A 2×2 matrix morphs the plane: basis vectors, a passenger vector, determinant as area.',
    DEFAULT_M,
  ),
  makeDefinition(
    'linear-transformation-shear',
    'A shear',
    'Same story with a pure shear matrix [1 1; 0 1].',
    { a: 1, b: 0, c: 1, d: 1 },
  ),
  makeDefinition(
    'linear-transformation-rotation',
    'A rotation',
    'Same story with a (slightly scaled) rotation — nothing stretches unevenly.',
    { a: 0.87, b: 0.5, c: -0.5, d: 0.87 },
  ),
  makeDefinition(
    'linear-transformation-singular',
    'A singular matrix',
    'det = 0: the plane collapses onto a line, a dimension is lost.',
    { a: 1.2, b: 0.6, c: 0.6, d: 0.3 },
  ),
]

export interface LinearTransformationProps {
  matrix?: Mat
  title?: string
}

export function LinearTransformation({ matrix = DEFAULT_M, title = 'A matrix moves space' }: LinearTransformationProps) {
  const det = matrix.a * matrix.d - matrix.b * matrix.c
  const acts = useMemo(() => makeActs(det), [det])
  const setup = useMemo(() => makeSetup(matrix, det), [matrix, det])
  return <Scene title={title} acts={acts} setup={setup} />
}
