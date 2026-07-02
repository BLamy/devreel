import React from 'react'
import { Scene } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { ink, palette } from '../core/theme'
import { caption, glowFilter, mathLabel, writeOn, type G } from '../core/draw'
import { ease } from '3b1bd3/core'
import { fromTimeline, type SceneState } from '../lib3b1bd3'

// Demo of the 3b1bd3 channel-timeline adapter (src/viz/lib3b1bd3.ts). The
// scene is authored in SECONDS against the library Timeline — three captions
// = three beats = three devreel acts (named cap-<caption id>) — and three
// channels drive a dot easing across, a ring drawing itself on, and a
// counter. Lessons play it exactly like any native act-based animation.

const X0 = 140
const X1 = 820
const TRACK_Y = 150
const RING = { x: 300, y: 360, r: 70 }
const COUNT = { x: 660, y: 384 }

export const definition: VizDefinition = fromTimeline(
  {
    id: 'lib-3b1b-demo',
    title: 'Channels, not acts',
    summary:
      'Adapter demo: a 3b1bd3 channel timeline — a dot easing across, a draw-on ring, a counting label — driven beat by beat as devreel acts.',
  },
  (tl) => {
    // ------------------------------------------------- channels + keyframes
    const dotX = tl.channel('dotX', 0)
    const ring = tl.channel('ring', 0)
    const count = tl.channel('count', 0)

    // beat 1 — caption id 1 → act "cap-1"
    tl.caption({ at: 0, dur: 3.0, text: 'One channel: the dot eases across.' })
    tl.tween(dotX, 1, { at: 0.4, dur: 2.4, ease: ease.move })
    // beat 2 — caption id 3 → act "cap-3"
    tl.caption({ at: 3.5, dur: 3.0, text: 'A second channel draws the ring on.' })
    tl.tween(ring, 1, { at: 3.9, dur: 2.4, ease: ease.draw })
    // beat 3 — caption id 5 → act "cap-5"
    tl.caption({ at: 7.0, dur: 3.2, text: 'A third just counts — every frame is sample(t).' })
    tl.tween(count, 240, { at: 7.3, dur: 2.6, ease: ease.linear })
    tl.hold(0, 10.6)

    // ------------------------------------------------------------ the stage
    return ({ svg, defs, width, height }) => {
      const glow = glowFilter(defs, 'lib3b1b-glow', 4)
      const root = svg.append('g') as G

      root
        .append('line')
        .attr('x1', X0)
        .attr('x2', X1)
        .attr('y1', TRACK_Y)
        .attr('y2', TRACK_Y)
        .attr('stroke', ink.axis)
      const dot = root
        .append('circle')
        .attr('r', 9)
        .attr('cx', X0)
        .attr('cy', TRACK_Y)
        .attr('fill', palette.blue)
        .attr('filter', glow)
      mathLabel(root, { x: X0, y: TRACK_Y + 32, text: 'ease.move', color: ink.muted, size: 13, mono: true, anchor: 'start' })

      const ringPath = root
        .append('path')
        .attr(
          'd',
          `M ${RING.x} ${RING.y - RING.r} A ${RING.r} ${RING.r} 0 1 1 ${RING.x} ${RING.y + RING.r} A ${RING.r} ${RING.r} 0 1 1 ${RING.x} ${RING.y - RING.r}`,
        )
        .attr('fill', 'none')
        .attr('stroke', palette.yellow)
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0)
      mathLabel(root, { x: RING.x, y: RING.y + RING.r + 28, text: 'ease.draw', color: ink.muted, size: 13, mono: true })

      const counter = mathLabel(root, { x: COUNT.x, y: COUNT.y, text: '0', color: palette.gold, size: 56, mono: true })
      mathLabel(root, { x: COUNT.x, y: COUNT.y + 36, text: 'ease.linear', color: ink.muted, size: 13, mono: true })

      const cap = caption(root, { x: width / 2, y: height - 22, text: '', size: 16 })

      // ------------------------------------------------------ per-frame draw
      return (s: SceneState) => {
        dot.attr('cx', X0 + (X1 - X0) * s.get(dotX))
        const r = s.get(ring)
        writeOn(ringPath, r)
        ringPath.attr('opacity', r > 0 ? 1 : 0)
        counter.text(String(Math.round(s.get(count))))
        const c = s.captions[s.captions.length - 1]
        cap.text(c?.text ?? '').attr('opacity', c?.u ?? 0)
      }
    }
  },
)

export function Lib3b1bDemo() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
