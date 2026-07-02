import type { VizDefinition } from '../core/definition'
import type { SceneCtx } from '../core/Scene'
import { phase, type Act, type Sample } from '../core/timeline'
import { font, ink, palette, surface } from '../core/theme'
import { caption, clamp01, lerp, stagger, type G } from '../core/draw'
import { drawIcon, familyColor, groupColor } from './icons'
import type { ArchFlow, ArchSpec, StepKind } from './types'

// Turn a declarative ArchSpec into a VizDefinition: act 1 draws the diagram,
// then each flow is an act whose steps animate as labeled pulses hopping
// between nodes. Everything is a pure function of the timeline sample, so
// lesson scrubbing scrubs the traffic.

const STEP_COLOR: Record<StepKind, string> = {
  request: palette.yellow,
  response: palette.green,
  data: palette.purple,
  event: palette.teal,
  error: palette.red,
}

const NODE_R = 27 // pulse trim radius

export function createArchDefinition(spec: ArchSpec): VizDefinition {
  const introName = spec.intro?.name ?? 'the architecture'
  const acts: Act[] = [
    {
      name: introName,
      duration: spec.intro?.duration ?? 3000,
      hold: 400,
      say: spec.intro?.say,
    },
    ...spec.flows.map((f) => ({
      name: f.name,
      duration: f.duration ?? f.steps.length * 950 + 1200,
      hold: f.hold ?? 500,
      say: f.say,
    })),
  ]

  const setup = ({ svg, defs, width, height, tl }: SceneCtx) => {
    void defs
    const root = svg.append('g') as G
    const nodeById = new Map(spec.nodes.map((n) => [n.id, n]))

    // ── groups ──
    const groupSel = (spec.groups ?? []).map((gr) => {
      const color = groupColor(gr.kind)
      const g = root.append('g') as G
      g.append('rect')
        .attr('x', gr.x)
        .attr('y', gr.y)
        .attr('width', gr.w)
        .attr('height', gr.h)
        .attr('rx', 12)
        .attr('fill', color)
        .attr('fill-opacity', 0.035)
        .attr('stroke', color)
        .attr('stroke-opacity', 0.35)
        .attr('stroke-dasharray', '6,7')
      g.append('text')
        .attr('x', gr.x + 12)
        .attr('y', gr.y + 20)
        .attr('fill', color)
        .attr('font-size', 12)
        .attr('font-family', font.ui)
        .attr('letter-spacing', 1)
        .text(gr.label.toUpperCase())
      return { gr, g }
    })

    // ── edges (beneath nodes) ──
    const edgeSel = spec.edges.map((e) => {
      const a = nodeById.get(e.from)!
      const b = nodeById.get(e.to)!
      const g = root.append('g') as G
      const line = g
        .append('line')
        .attr('x1', a.x)
        .attr('y1', a.y)
        .attr('x2', b.x)
        .attr('y2', b.y)
        .attr('stroke', ink.axis)
        .attr('stroke-width', 1.4)
      if (e.dashed) line.attr('stroke-dasharray', '5,6')
      if (e.label) {
        g.append('text')
          .attr('x', (a.x + b.x) / 2)
          .attr('y', (a.y + b.y) / 2 - 7)
          .attr('text-anchor', 'middle')
          .attr('fill', ink.muted)
          .attr('font-size', 11)
          .attr('font-family', font.ui)
          .text(e.label)
      }
      return { e, g }
    })

    // ── nodes ──
    const nodeSel = spec.nodes.map((n) => {
      const color = familyColor(n.kind)
      const g = root.append('g').attr('transform', `translate(${n.x},${n.y})`) as G
      const ring = g
        .append('circle')
        .attr('r', 30)
        .attr('fill', 'none')
        .attr('stroke', palette.yellow)
        .attr('stroke-width', 2)
        .attr('opacity', 0)
      g.append('rect')
        .attr('x', -23)
        .attr('y', -21)
        .attr('width', 46)
        .attr('height', 42)
        .attr('rx', 10)
        .attr('fill', '#141a29')
        .attr('stroke', color)
        .attr('stroke-opacity', 0.75)
        .attr('stroke-width', 1.5)
      const icon = g.append('g') as G
      drawIcon(icon, n.kind, color)
      g.append('text')
        .attr('x', 0)
        .attr('y', 36)
        .attr('text-anchor', 'middle')
        .attr('fill', ink.primary)
        .attr('font-size', 13)
        .attr('font-family', font.ui)
        .text(n.label)
      if (n.sublabel) {
        g.append('text')
          .attr('x', 0)
          .attr('y', 50)
          .attr('text-anchor', 'middle')
          .attr('fill', ink.muted)
          .attr('font-size', 10.5)
          .attr('font-family', font.ui)
          .text(n.sublabel)
      }
      const cross = g.append('g').attr('opacity', 0) as G
      cross.append('line').attr('x1', -14).attr('y1', -14).attr('x2', 14).attr('y2', 14).attr('stroke', palette.red).attr('stroke-width', 3)
      cross.append('line').attr('x1', 14).attr('y1', -14).attr('x2', -14).attr('y2', 14).attr('stroke', palette.red).attr('stroke-width', 3)
      return { n, g, ring, cross }
    })
    const nodeIndex = new Map(nodeSel.map((s, i) => [s.n.id, i]))

    // ── flow pulses + labels + badges ──
    const flowSel = spec.flows.map((f) => {
      const steps = f.steps.map((st) => {
        const dot = root.append('circle').attr('r', 5).attr('opacity', 0)
        const lab = root
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('font-size', 12.5)
          .attr('font-family', font.ui)
          .attr('paint-order', 'stroke')
          .attr('stroke', surface)
          .attr('stroke-width', 4)
          .attr('opacity', 0)
        return { st, dot, lab }
      })
      const badges = (f.badges ?? []).map((b) => {
        const n = nodeById.get(b.node)!
        const color = b.tone === 'err' ? palette.red : b.tone === 'warn' ? palette.gold : palette.green
        const g = root.append('g').attr('opacity', 0) as G
        const w = 14 + b.text.length * 6.6
        g.append('rect')
          .attr('x', n.x - w / 2)
          .attr('y', n.y - 52)
          .attr('width', w)
          .attr('height', 20)
          .attr('rx', 10)
          .attr('fill', '#0a0d15')
          .attr('stroke', color)
          .attr('stroke-width', 1)
        g.append('text')
          .attr('x', n.x)
          .attr('y', n.y - 38)
          .attr('text-anchor', 'middle')
          .attr('fill', color)
          .attr('font-size', 11.5)
          .attr('font-family', font.mono)
          .text(b.text)
        return g
      })
      return { f, steps, badges }
    })

    const cap = caption(root, { x: width / 2, y: height - 14, text: '', size: 15 })
    const CAPTIONS: Record<string, string> = Object.fromEntries([
      [introName, spec.intro?.caption ?? spec.title],
      ...spec.flows.map((f) => [f.name, f.caption ?? '']),
    ])

    return (s: Sample) => {
      const pIntro = phase(tl, s, introName)

      groupSel.forEach(({ g }, i) => g.attr('opacity', stagger(clamp01(pIntro * 2.4), i, Math.max(groupSel.length, 1), 0.6)))
      edgeSel.forEach(({ g }, i) => g.attr('opacity', stagger(clamp01(pIntro * 1.4 - 0.4), i, edgeSel.length, 0.8) * 0.85))

      // failures accumulate act by act (recover clears)
      const failed = new Set<string>()
      spec.flows.forEach((f, fi) => {
        const p = phase(tl, s, f.name)
        if (p > 0.15) {
          for (const id of f.recover ?? []) failed.delete(id)
          for (const id of f.fail ?? []) failed.add(id)
        }
        void fi
      })

      nodeSel.forEach(({ n, g, cross }, i) => {
        const reveal = stagger(clamp01(pIntro * 1.5 - 0.15), i, nodeSel.length, 0.75)
        const dead = failed.has(n.id)
        g.attr('opacity', reveal * (dead ? 0.45 : 1))
        cross.attr('opacity', dead ? 1 : 0)
      })

      // ring intensities recomputed each frame
      const ringHeat = new Array(nodeSel.length).fill(0)

      flowSel.forEach(({ f, steps, badges }) => {
        const p = phase(tl, s, f.name)
        const active = s.name === f.name
        const n = steps.length
        steps.forEach(({ st, dot, lab }, i) => {
          // each step gets its window of the act, with a little overlap
          const t = stagger(p, i, n, 0.15)
          const inFlight = active && t > 0 && t < 1
          if (!inFlight) {
            dot.attr('opacity', 0)
            lab.attr('opacity', 0)
          } else {
            const a = nodeById.get(st.from)!
            const b = nodeById.get(st.to)!
            const dx = b.x - a.x
            const dy = b.y - a.y
            const len = Math.hypot(dx, dy) || 1
            const sx = a.x + (dx / len) * NODE_R
            const sy = a.y + (dy / len) * NODE_R
            const ex = b.x - (dx / len) * NODE_R
            const ey = b.y - (dy / len) * NODE_R
            const color = STEP_COLOR[st.kind ?? 'request']
            dot
              .attr('cx', lerp(sx, ex, t))
              .attr('cy', lerp(sy, ey, t))
              .attr('fill', color)
              .attr('opacity', Math.sin(Math.PI * t) * 0.95 + 0.05)
            lab
              .attr('x', (sx + ex) / 2)
              .attr('y', (sy + ey) / 2 - 12)
              .attr('fill', color)
              .text(st.label ?? '')
              .attr('opacity', st.label ? Math.min(1, Math.sin(Math.PI * t) * 1.6) : 0)
            // heat the destination as the pulse lands
            const bi = nodeIndex.get(st.to)
            if (bi != null && t > 0.75) ringHeat[bi] = Math.max(ringHeat[bi], (t - 0.75) / 0.25)
          }
        })
        badges.forEach((bg) => bg.attr('opacity', p > 0.55 ? clamp01((p - 0.55) * 4) : 0))
      })

      nodeSel.forEach(({ ring }, i) => ring.attr('opacity', ringHeat[i] * 0.9))

      const text = CAPTIONS[s.name] ?? ''
      cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
    }
  }

  return { id: spec.id, title: spec.title, summary: spec.summary, acts, setup }
}
