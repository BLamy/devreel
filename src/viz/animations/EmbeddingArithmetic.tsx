import React from 'react'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette } from '../core/theme'
import { arrowMarker, caption, clamp01, glowFilter, lerp, mathLabel, stagger, type G } from '../core/draw'

// king − man + woman ≈ queen. Word coordinates are laid out so the gender
// offset (woman − man) and the capital-of offset are exactly parallel — the
// point being that in a trained embedding space, *directions are meanings*.

const GENDER: [number, number] = [0.5, 1.4]
const CAPITAL: [number, number] = [0.6, 1.1]

const WORDS: { w: string; x: number; y: number; kind: 'principal' | 'pair' | 'filler'; color?: string }[] = [
  { w: 'man', x: -1.6, y: -0.9, kind: 'principal', color: palette.teal },
  { w: 'woman', x: -1.6 + GENDER[0], y: -0.9 + GENDER[1], kind: 'principal', color: palette.pink },
  { w: 'king', x: 0.6, y: -0.5, kind: 'principal', color: palette.blue },
  { w: 'queen', x: 0.6 + GENDER[0], y: -0.5 + GENDER[1], kind: 'principal', color: palette.yellow },
  { w: 'france', x: -3.3, y: -1.9, kind: 'pair' },
  { w: 'paris', x: -3.3 + CAPITAL[0], y: -1.9 + CAPITAL[1], kind: 'pair' },
  { w: 'japan', x: 2.4, y: -1.7, kind: 'pair' },
  { w: 'tokyo', x: 2.4 + CAPITAL[0], y: -1.7 + CAPITAL[1], kind: 'pair' },
  { w: 'banana', x: -0.5, y: -2.1, kind: 'filler' },
  { w: 'guitar', x: 3.4, y: 1.7, kind: 'filler' },
  { w: 'river', x: -3.1, y: 1.9, kind: 'filler' },
  { w: 'cloud', x: 2.0, y: 2.1, kind: 'filler' },
]

const ACTS: Act[] = [
  {
    name: 'words as points',
    duration: 2800,
    hold: 300,
    say: 'A language model stores every word as a point in space. Similar words live near each other — but the geometry goes deeper than neighborhoods.',
  },
  {
    name: 'meaning has directions',
    duration: 3000,
    hold: 400,
    say: 'Draw the arrow from man to woman. That arrow is not just a line — it is a direction that means something.',
  },
  {
    name: 'move the direction',
    duration: 3400,
    hold: 400,
    say: 'Pick the arrow up, carry it across the space, and set it down on king.',
  },
  {
    name: 'the analogy completes',
    duration: 2600,
    hold: 700,
    say: 'It lands on queen. King, minus man, plus woman, equals queen. The model was never taught this — it fell out of the geometry.',
  },
  {
    name: 'directions are everywhere',
    duration: 3200,
    hold: 900,
    say: 'And it is not just gender. France to Paris. Japan to Tokyo. The same arrow — capital of. In embedding space, meanings are directions.',
  },
]

const CAPTIONS: Record<string, string> = {
  'words as points': 'every word = a learned vector',
  'meaning has directions': 'woman − man: a direction, not just a distance',
  'move the direction': 'add the same direction to king…',
  'the analogy completes': 'king − man + woman ≈ queen',
  'directions are everywhere': 'the same trick: country → capital, tense, plurality, sentiment…',
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  const glow = glowFilter(defs, 'ea-glow', 3.5)
  const root = svg.append('g') as G

  const unit = 102
  const PX = (x: number) => width / 2 + 30 + x * unit
  const PY = (y: number) => height / 2 - 14 - y * unit

  // faint grid
  const grid = root.append('g') as G
  for (let k = -5; k <= 5; k++) {
    grid.append('line').attr('x1', PX(k)).attr('x2', PX(k)).attr('y1', 40).attr('y2', 480)
    grid.append('line').attr('y1', PY(k)).attr('y2', PY(k)).attr('x1', 30).attr('x2', width - 30)
  }
  grid.selectAll('line').attr('stroke', ink.grid)

  const arrowPink = arrowMarker(defs, 'ea-arrow-pink', palette.pink)
  const arrowGold = arrowMarker(defs, 'ea-arrow-gold', palette.gold)

  // word dots + labels
  const dots = WORDS.map((wd) => {
    const g = root.append('g') as G
    const color = wd.color ?? (wd.kind === 'pair' ? ink.secondary : ink.muted)
    g.append('circle')
      .attr('cx', PX(wd.x))
      .attr('cy', PY(wd.y))
      .attr('r', wd.kind === 'principal' ? 6 : 4.5)
      .attr('fill', color)
    mathLabel(g, {
      x: PX(wd.x),
      y: PY(wd.y) - 13,
      text: wd.w,
      color: wd.kind === 'principal' ? color : ink.secondary,
      size: wd.kind === 'principal' ? 17 : 14,
      italic: false,
    })
    return { ...wd, g }
  })
  const at = (w: string) => WORDS.find((d) => d.w === w)!

  // the gender arrow (drawn at man, then carried to king)
  const genderArrow = root.append('line').attr('stroke', palette.pink).attr('stroke-width', 3).attr('marker-end', arrowPink)
  const genderLab = mathLabel(root, { x: 0, y: 0, text: 'woman − man', color: palette.pink, size: 15 })
  const carryTrail = root
    .append('line')
    .attr('stroke', palette.pink)
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,6')
    .attr('opacity', 0)

  // landing highlight on queen
  const landing = root
    .append('circle')
    .attr('cx', PX(at('queen').x))
    .attr('cy', PY(at('queen').y))
    .attr('r', 14)
    .attr('fill', 'none')
    .attr('stroke', palette.yellow)
    .attr('stroke-width', 2)
    .attr('filter', glow)
  const eqLab = mathLabel(root, { x: width / 2 + 30, y: 66, text: 'king − man + woman ≈ queen', color: ink.primary, size: 21 })

  // capital-of arrows for the finale
  const capitalArrows = (['france', 'japan'] as const).map((c) => {
    const from = at(c)
    const to = at(c === 'france' ? 'paris' : 'tokyo')
    const line = root.append('line').attr('stroke', palette.gold).attr('stroke-width', 2.5).attr('marker-end', arrowGold)
    line.datum({ from, to })
    return line
  })
  const capLab = mathLabel(root, { x: PX(-2.55), y: PY(-1.05), text: 'capital of', color: palette.gold, size: 14 })

  const cap = caption(root, { x: width / 2, y: height - 16, text: '', size: 15 })

  return (s: Sample) => {
    const pWords = phase(tl, s, 'words as points')
    const pDir = phase(tl, s, 'meaning has directions')
    const pMove = phase(tl, s, 'move the direction')
    const pDone = phase(tl, s, 'the analogy completes')
    const pAll = phase(tl, s, 'directions are everywhere')

    dots.forEach((d, i) => d.g.attr('opacity', stagger(pWords, i, dots.length, 0.8)))

    // arrow base slides from man to king during the carry
    const man = at('man')
    const king = at('king')
    const bx = lerp(man.x, king.x, pMove)
    const by = lerp(man.y, king.y, pMove)
    const grow = pDir
    genderArrow
      .attr('x1', PX(bx))
      .attr('y1', PY(by))
      .attr('x2', PX(bx + GENDER[0] * grow))
      .attr('y2', PY(by + GENDER[1] * grow))
      .attr('opacity', pDir > 0.02 ? 1 : 0)
    genderLab
      .attr('x', PX(bx + GENDER[0] * 0.5) - 58)
      .attr('y', PY(by + GENDER[1] * 0.5))
      .attr('opacity', pDir * (1 - pMove * 0.5))
      .text(pMove > 0.5 ? '+ (woman − man)' : 'woman − man')
    carryTrail
      .attr('x1', PX(man.x))
      .attr('y1', PY(man.y))
      .attr('x2', PX(bx))
      .attr('y2', PY(by))
      .attr('opacity', pMove > 0 && pMove < 1 ? 0.5 : 0)

    landing.attr('opacity', pDone > 0 ? pDone * (0.7 + 0.3 * Math.sin(pDone * Math.PI * 3)) : 0)
    eqLab.attr('opacity', clamp01(pDone * 2 - 0.4))

    capitalArrows.forEach((line, i) => {
      const { from, to } = line.datum() as { from: (typeof WORDS)[number]; to: (typeof WORDS)[number] }
      const t = stagger(pAll, i, 2, 0.4)
      line
        .attr('x1', PX(from.x))
        .attr('y1', PY(from.y))
        .attr('x2', PX(lerp(from.x, to.x, t)))
        .attr('y2', PY(lerp(from.y, to.y, t)))
        .attr('opacity', t > 0.02 ? 0.95 : 0)
    })
    capLab.attr('opacity', pAll)

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'embedding-arithmetic',
  title: 'Embeddings — meaning is a direction',
  summary: 'king − man + woman ≈ queen: meaning as directions in vector space.',
  acts: ACTS,
  setup,
}

export function EmbeddingArithmetic() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
