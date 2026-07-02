---
name: viz-scene
description: Use the src/viz 3b1b-style animation suite in devreel lessons, or author a new animation for it. Triggers - adding a "viz" / "animation" / "3b1b" / "timeline" scene to a lesson, explaining a concept (attention, gradient descent, convolution, eigenvectors, Bayes, diffusion, BFS...) before code, or creating/registering a new VizDefinition.
---

# viz-scene — concept animations in devreel lessons

Two jobs: (A) put an EXISTING animation into a lesson as `viz` scenes;
(B) author and register a NEW animation. Never invent animation ids or act
names — the catalog lives in `src/viz/manifest.mjs` (also embedded in
`generator/prompts/storyboard.txt`).

## A. Using an existing animation in a lesson

A viz scene is an ordinary lesson Scene whose focus is `viz`:

```js
{
  id: 's2',
  chapter: 'The fix',
  narration: 'Momentum keeps **velocity** between steps.',
  say: 'Momentum keeps velocity between steps. Watch it carry over the ridge.',
  focus: 'viz',
  action: { tool: 'viz', animation: 'gradient-descent', act: 'momentum' },
}
```

- `animation` — an id from `src/viz/manifest.mjs` (e.g. `gradient-descent`,
  `attention-mechanism`, `graph-bfs`). Unknown id = validator HARD ERROR.
- `act` — one act name of that animation (e.g. `gradient-descent` has
  `"the loss landscape" → "gradient descent" → "momentum" → "Adam" → "compare"`).
  Unknown act = dropped with a warning; the scene then sweeps the whole timeline.
- Omit `act` to sweep the entire animation in one scene.

How pacing works (no timing code needed): the Player computes each scene's
progress 0→1 from the narration audio (or `autoAdvanceMs` when unbaked).
`src/panes/VizPane.tsx` maps that progress linearly onto the named act's time
window (`duration + hold`) and calls `timeline.sample(mappedTime)` — so the act
plays exactly as long as its narration, scrubbing the lesson scrubs the
animation, and once the lesson moves past the scene the pane freezes at the
act's final frame.

Authoring rules:
- Play acts IN ORDER across consecutive scenes — each animation is a story.
  You may stop early; don't skip around.
- One scene = one act. A 2–5 scene viz beat at the START of a lesson (concept
  first, then code) or right before the tricky code works best.
- Write `say` grounded in what the act actually shows (the manifest `summary`
  tells you); the visuals already carry captions, so add insight, don't read labels.
- Viz scenes need no workspace files; a lesson may be pure viz
  (`workspace: { files: {} }`). See `src/lessons/viz-demo.lesson.mjs` for a
  complete worked example (five scenes walking `gradient-descent` act by act).

## B. Authoring a NEW animation

Anatomy — one file `src/viz/animations/<Name>.tsx` exporting a `VizDefinition`
(`src/viz/core/definition.ts`):

```tsx
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette, surface } from '../core/theme'

const ACTS: Act[] = [
  { name: 'the setup', duration: 3000, hold: 600, say: 'Here is the object.' },
  { name: 'the transform', duration: 4000, hold: 800, say: 'Now watch it move.' },
]

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  // build the FULL scene graph once with d3 (grid, objects, labels)...
  return (s: Sample) => {
    // ...and mutate attributes only, as a pure function of s
    const p1 = phase(tl, s, 'the transform') // 0 before, eased t during, 1 after
    // node.attr('transform', `translate(${x0 + p1 * dx},0)`)
  }
}

export const definition: VizDefinition = {
  id: 'my-animation', // kebab-case; used by lessons + manifest
  title: 'My animation',
  summary: 'One line for the lesson-authoring catalog.',
  acts: ACTS,
  setup,
}

export function MyAnimation() {
  return <Scene title={definition.title} acts={ACTS} setup={setup} />
}
```

THE PURE-SAMPLE RULE (non-negotiable): every frame is a pure function of the
`Sample` — no `setInterval`/`requestAnimationFrame`/d3 transitions inside the
animation, no unseeded randomness, no state accumulated across frames. The
lesson runtime scrubs and replays arbitrary times; anything self-animating or
random breaks determinism. Precompute randomness with a seeded generator in
`setup` (see `CentralLimit.tsx`).

Style — follow the grammar in `src/viz/README.md`: nothing teleports; write-on,
don't appear; one idea on screen; recessive grid (`ink.grid`/`ink.axis`), at
most ~4 luminous foreground objects, each direct-labeled with a `palette` color
assigned by entity (blue = primary object, yellow = the answer, red = error/
gradient, purple = second-order, green = target...). Surface is `theme.surface`;
helpers (grids, arrowed vectors, write-on paths, math labels) live in
`src/viz/core/draw.ts`. Acts: `duration` is the motion, `hold` is the 3b1b beat
of rest; default ease is `easeCubicInOut`.

Register in THREE places (all mandatory):
1. `src/viz/registry.ts` — import the `definition` (or `definitions` array for
   variants) and add it to `ALL`. Ids must be unique.
2. `src/viz/manifest.mjs` — append `{ id, title, summary, acts: [...names] }`.
   This plain-JS file is what the Node generator validates lessons against;
   `registry.ts` cross-checks it in dev and logs loudly on any drift.
3. `src/viz/animations/<Name>.stories.tsx` — Storybook story per the existing
   pattern (`title: 'Viz/<Name>'`, `component: <Name>`).

## C. Verify

```bash
# lesson spec is valid (unknown animation = error, unknown act = warning+drop)
node -e "import('./src/lessons/<slug>.lesson.mjs').then(async m=>{const v=(await import('./generator/validate.mjs')).validateLesson(m.lesson);console.log(JSON.stringify(v,null,2))})"

# types + build
npm run typecheck
npm run build

# eyeball a new animation in Storybook (scrub the whole timeline — no teleports,
# and scrubbing backwards must look identical to playing forwards)
npm run storybook   # → http://localhost:6006

# play a lesson's viz scenes in the real Player
npm run dev         # → http://localhost:5173/?lesson=<slug>
```

Also confirm the dev console shows no `[viz]` registry/manifest mismatch errors
(the drift check in `src/viz/registry.ts`).

## Library timelines (3b1bd3)

An animation can instead be authored against the **3b1bd3** channel/keyframe
Timeline (local package `3b1bd3`, seconds-based, caption beats, per-keyframe
eases) and adapted to a normal `VizDefinition` with
`fromTimeline` from `src/viz/lib3b1bd3.ts`. Prefer it when you want
**editability** (stable keyframe/caption ids → the library's Motion Studio can
retime them; `exportOverrides()` diffs) and **scrub-exact retiming** of many
overlapping tweens on independent channels; prefer **native acts** when the
motion is naturally per-act `phase()` staging, when you need house-picked act
names in `manifest.mjs`, or when the scene has no reason to depend on the
library.

```ts
export const definition: VizDefinition = fromTimeline(
  { id: 'my-scene', title: '…', summary: '…' },
  (tl) => {
    // 1. runs ONCE at module scope — channels/tweens/captions ONLY, no DOM
    const x = tl.channel('x', 0)
    tl.caption({ at: 0, dur: 3, text: 'Beat one.' })       // beat → one act
    tl.tween(x, 1, { at: 0.4, dur: 2.4, ease: ease.move }) // SECONDS
    return ({ svg, defs, width, height }) => {
      // 2. runs per setup(ctx) — build the scene graph imperatively (d3)
      const dot = (svg.append('g') as G).append('circle')…
      return (s: SceneState) => {
        // 3. per frame — pure function of the library SceneState
        dot.attr('cx', 140 + 680 * s.get(x))
        // captions: s.captions carries the active caption + fade envelope u
      }
    }
  },
)
```

Caveats (see `src/viz/animations/Lib3b1bDemo.tsx` for a worked example):
- **Units:** the library timeline runs in SECONDS; devreel acts/Samples in
  MILLISECONDS. The adapter converts (`Sample.time / 1000`) — never mix.
- **Acts are derived**, via the library's `actsFromTimeline`: one act per
  caption beat, named `cap-<caption id>` (ids = creation order of
  tweens+captions, so REORDERING build calls renames acts), `say` = caption
  text, `hold` = silence until the next beat. Put those exact `cap-*` names in
  `manifest.mjs`; get them by replaying the build in Node and printing
  `actsFromTimeline(tl).map(a => a.name)` (stub `.css` imports — bare Node
  can't load the library's `player.css`).
- **Beat-window clamp:** each frame the adapter clamps the mapped seconds to
  the current act's `[beatStart, nextBeat]` window, so a lesson scene driving
  one act (the MP3 stays the clock) advances the library timeline beat by
  beat and can't leak a neighbouring beat's motion. Consequence: motion must
  live inside its own beat's window — a tween that straddles the next caption
  gets frozen at the boundary while that act plays.
- All native rules still apply (pure sample, no self-animation, register in
  registry.ts + manifest.mjs + a story).
