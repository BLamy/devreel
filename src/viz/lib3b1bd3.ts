import { Timeline, type SceneState } from '3b1bd3/core'
import { actsFromTimeline } from '3b1bd3/acts'
import type { SceneCtx } from './core/Scene'
import type { VizDefinition } from './core/definition'
import type { Act, Sample } from './core/timeline'

export type { SceneState } from '3b1bd3/core'
export { Timeline } from '3b1bd3/core'

/**
 * Adapter: author an animation against the 3b1bd3 channel/keyframe Timeline
 * (seconds, captions, per-keyframe eases, retimable in its Motion Studio) and
 * expose it as a plain devreel `VizDefinition` — so lessons drive it exactly
 * like a native act-based animation (`{ tool: 'viz', animation: id, act }`).
 *
 * Shape (three stages, because devreel builds scene graphs imperatively and
 * `ctx.svg` only exists at `setup` time, while the acts must exist at module
 * scope):
 *
 *   1. `build(tl)`   — runs ONCE, inside `fromTimeline`, at module scope of
 *      the caller. Declare channels / tweens / captions here. NO DOM.
 *   2. `mount(ctx)`  — the function `build` returns; runs per `setup(ctx)`.
 *      Append the full scene graph to `ctx.svg` with d3 (SceneCtx conventions:
 *      build everything once, mutate attributes only afterwards).
 *   3. `draw(s)`     — the function `mount` returns; the per-frame renderer.
 *      A pure function of the library `SceneState`: read values with
 *      `s.get(channel)` and the caption fade envelopes from `s.captions`,
 *      and write SVG attributes.
 *
 * Act mapping — the library's caption BEATS become devreel acts via the
 * library's own `actsFromTimeline` (its Act shape is structurally identical
 * to devreel's): one act per caption, named `cap-<caption id>`, `say` = the
 * caption text, `duration` = the caption's on-screen span in ms, silence
 * until the next beat = `hold` (plus an `intro` act if the first caption
 * starts after 0). List those derived names in `manifest.mjs`.
 *
 * Time mapping — the library Timeline runs in SECONDS, devreel acts in
 * MILLISECONDS. Each frame maps the devreel `Sample.time` (global ms on the
 * derived act timeline — in lessons, the narration MP3 is the clock) to
 * `time / 1000` seconds, CLAMPED to the current act's beat window
 * `[beatStart, nextBeat]` (from the act starts, i.e. `tl.beats`, indexed by
 * `sample.index`). So when VizPane plays one act per lesson scene, the
 * library timeline advances beat by beat and can never leak motion from a
 * neighbouring beat, while sweeps/scrubs remain exact.
 */
export function fromTimeline(
  meta: { id: string; title: string; summary: string },
  build: (tl: Timeline) => (ctx: SceneCtx) => (s: SceneState) => void,
): VizDefinition {
  const tl = new Timeline()
  const mount = build(tl)

  // Derived acts: library Act is structurally assignable to devreel Act.
  const acts: Act[] = actsFromTimeline(tl)

  // Beat windows in ms on the derived act timeline (identical to what
  // devreel's createTimeline(acts).starts computes, so Sample.index and
  // Sample.time line up with these by construction).
  const startsMs: number[] = []
  let totalMs = 0
  for (const a of acts) {
    startsMs.push(totalMs)
    totalMs += a.duration + (a.hold ?? 0)
  }

  return {
    ...meta,
    acts,
    setup: (ctx: SceneCtx) => {
      const draw = mount(ctx)
      return (s: Sample) => {
        // ms → seconds, clamped to the current act's beat window.
        const i = Math.max(0, Math.min(s.index, acts.length - 1))
        const lo = startsMs[i] / 1000
        const hi = (i + 1 < acts.length ? startsMs[i + 1] : totalMs) / 1000
        const sec = Math.min(hi, Math.max(lo, s.time / 1000))
        draw(tl.sample(sec))
      }
    },
  }
}
