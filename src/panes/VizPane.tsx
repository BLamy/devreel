import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { VizAction } from '../lesson/types'
import { getViz } from '../viz/registry'
import { createTimeline, type Timeline } from '../viz/core/timeline'
import { surface, ink, font } from '../viz/core/theme'

const W = 960
const H = 540

export interface VizPaneProps {
  /** The current (or most recent) viz action in the lesson. */
  action: VizAction | null
  /**
   * Progress of the driving scene, 0→1 (frozen at 1 once the lesson has moved
   * past the viz scene). The pane maps this onto the named act's local time —
   * fully deterministic, so lesson scrubbing scrubs the animation.
   */
  progress: number
}

/**
 * The lesson runtime's window into the 3b1b viz library. Unlike the Storybook
 * Scene player, this pane has no clock of its own: the lesson's audio clock
 * (scene index + intra-scene progress) IS the timeline, so narration and
 * animation stay locked together. A light critically-damped chase smooths the
 * coarse audio `timeupdate` ticks into 60fps motion.
 */
export function VizPane({ action, progress }: VizPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    id: string | null
    draw: ((s: ReturnType<Timeline['sample']>) => void) | null
    tl: Timeline | null
    shown: number // smoothed time (ms)
    target: number
  }>({ id: null, draw: null, tl: null, shown: 0, target: 0 })

  // (Re)build the scene graph when the animation id changes.
  const id = action?.animation ?? null
  useEffect(() => {
    const host = hostRef.current
    const st = stateRef.current
    if (!host || !id) return
    const def = getViz(id)
    host.innerHTML = ''
    if (!def) {
      host.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:${ink.secondary};font-family:${font.ui};font-size:14px">unknown animation “${id}”</div>`
      st.id = null
      st.draw = null
      st.tl = null
      return
    }
    const svg = d3
      .select(host)
      .append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .style('width', '100%')
      .style('height', '100%')
      .style('display', 'block') as d3.Selection<SVGSVGElement, unknown, null, undefined>
    const defs = svg.append('defs')
    const tl = createTimeline(def.acts)
    st.tl = tl
    st.draw = def.setup({ svg, defs, width: W, height: H, tl })
    st.id = id
    st.shown = 0
    st.draw(tl.sample(0))
  }, [id])

  // Map (act, progress) → target time on the animation's own timeline.
  useEffect(() => {
    const st = stateRef.current
    if (!st.tl) return
    const def = id ? getViz(id) : undefined
    if (!def) return
    let target: number
    const actName = action?.act
    const i = actName ? def.acts.findIndex((a) => a.name === actName) : -1
    if (i >= 0) {
      const len = def.acts[i].duration + (def.acts[i].hold ?? 0)
      target = st.tl.starts[i] + progress * len
    } else {
      target = progress * st.tl.total
    }
    st.target = target
  }, [action, progress, id])

  // Smoothing clock: chase the target so 4Hz audio ticks still render 60fps.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const st = stateRef.current
      const dt = Math.min(now - last, 100)
      last = now
      if (st.draw && st.tl) {
        const delta = st.target - st.shown
        if (Math.abs(delta) > 1) {
          // jump on big scrubs, chase smoothly otherwise
          st.shown = Math.abs(delta) > 4000 ? st.target : st.shown + delta * Math.min(1, (dt / 1000) * 10)
          st.draw(st.tl.sample(st.shown))
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0, background: surface }} />
}
