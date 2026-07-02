# devreel viz — a 3Blue1Brown-inspired animation suite

A library of D3-driven explainer animations for complex technical topics — the kind
you'd meet in arXiv papers: attention, diffusion, optimization dynamics, spectral
methods. Built as reusable React components, browsable in Storybook
(`npm run storybook`), and designed to slot into devreel lessons as a future
scene tool alongside `editor/preview/terminal/database/diagram`.

## The grammar (what makes it feel like 3b1b)

1. **Nothing teleports.** Every state change is a continuous transform — grids
   morph, points flow, weights fade. If a value changes, the viewer watches it change.
2. **Acts, not frames.** Each animation is a sequence of named *acts* (motivate →
   build → transform → generalize), each with its own duration and easing. The
   scrubber shows act boundaries so a presenter can jump to "the moment."
3. **Write-on, don't appear.** Curves draw themselves (stroke-dash write-on),
   labels fade in after the object they name, vectors grow from their tail.
4. **One idea on screen.** Recessive grid, dim axes, at most ~4 luminous foreground
   objects, each direct-labeled in its own color.
5. **The camera thinks.** Ease-in-out everywhere (`easeCubicInOut` default);
   anticipation holds before the key transform; a beat of rest after it.

## Palette (validated)

Manim-inspired, fixed categorical order — assign by entity, never cycle:

| slot | color | hex | typical role |
|------|-------|-----|--------------|
| 1 | blue | `#58C4DD` | primary object (î, query, signal) |
| 2 | yellow | `#FFD35A` | the highlight / the answer (ĵ, attention) |
| 3 | red | `#FC6255` | error, gradient, danger |
| 4 | purple | `#A874D6` | second-order object (momentum, key) |
| 5 | green | `#83C167` | target, value, converged |
| 6 | pink | `#C55F73` | comparison series |
| 7 | teal | `#5CD0B3` | auxiliary |
| 8 | gold | `#F0AC5F` | scalar readouts |

Surface `#0f131e` (dark blue-charcoal). Validated with the dataviz skill's
`validate_palette.js` (dark mode, this surface): **CVD separation PASS** (worst
adjacent ΔE 21.7, target ≥ 12), **chroma floor PASS**, **contrast vs surface PASS**
(all 8 ≥ 3:1). The lightness band check fails *by design*: luminous strokes on
near-black is the 3b1b aesthetic; contrast passes and every foreground object is
direct-labeled, so identity is never color-alone.

## Architecture

```
src/viz/
  core/
    theme.ts       palette, surface, ink tokens, fonts
    timeline.ts    act-based keyframe engine: global time → {act, eased local t}
    player.ts      rAF clock: play/pause/scrub/loop, subscriber per frame
    Scene.tsx      React wrapper: responsive 16:9 SVG + player chrome (act
                   markers, scrubber) — animations render via d3 into the svg,
                   no React re-render per frame
    draw.ts        d3 helpers: recessive grid/axes, arrowed vectors, write-on
                   paths, math labels, softmax bars, arrowhead defs
  animations/
    <Name>.tsx           the animation (setup + draw(sample) closure)
    <Name>.stories.tsx   Storybook story (fullscreen, dark)
```

Each animation implements `setup(ctx) → draw(sample)`: `setup` builds the static
scene graph once with d3; `draw` is called every frame with
`{ act, t (eased 0→1 within act), time }` and mutates attributes only. React never
re-renders during playback — 60fps holds even with ~1k particles.

## Narration

Every act carries a `say` line, spoken by the in-browser Web Speech API
(`core/narrator.ts`) — the dev-time stand-in for the ElevenLabs bake used by the
production lesson pipeline. The narrator prefers sane local voices (Samantha,
Google US English, natural Microsoft voices) and is toggled with the 🔊 button
in the player chrome. Chrome requires one user gesture before speech is
allowed, so autoplayed scenes are silent until the first click — same rule as
sound-on video.

## Catalog

**Built** (each has a Storybook story under `Viz/…`; ✕N = story variants):

| ID | Animation | Topic | arXiv relevance |
|----|-----------|-------|-----------------|
| V1 | `LinearTransformation` ✕4 | A 2×2 matrix as a morph of the plane; variants: shear, rotation, singular (det = 0 collapse) | foundations of everything |
| V2 | `Eigenvectors` | A ring of vectors hit by M — two directions never turn; finale is continuous power iteration | PageRank, PCA, spectral anything |
| V3 | `SVDDecomposition` | M = U·Σ·Vᵀ staged as rotate → stretch → rotate; the exact image of M overlaid as proof | low-rank, LoRA, compression |
| V5 | `FourierEpicycles` | Rotating vector chain tracing a square wave; term count grows | signal processing, positional encodings |
| V6 | `FourierWinding` | The winding machine: center of mass lurches at frequencies hiding in the signal | the Fourier transform itself |
| V7 | `Convolution` ✕2 | Flip–slide–multiply–sum; variants: Gaussian (blur) and derivative kernel (edge detection) | CNNs, filters, smoothing |
| V9 | `GradientDescent` | SGD vs momentum vs Adam racing on a non-convex contour landscape | every optimization section |
| V13 | `CentralLimit` | A seeded Galton board: 220 balls of coin flips stack into a bell, Gaussian overlaid | statistics everywhere |
| V14 | `BayesTheorem` | The medical-test classic as areas: 90 true positives drown in 891 false ones → 9.2% | priors, calibration, eval |
| V8 | `TaylorSeries` | Polynomials hug sin(x) one order at a time; higher orders hold on longer | approximation, why calculators work |
| V16 | `KLDivergence` | Pointwise surprise weighted by P, integrated live — then swapped to show the asymmetry | loss functions, RLHF objectives |
| V17 | `NeuralNetwork` | Forward-pass activations pulse layer-by-layer, then backprop flows gradients in reverse | deep learning intros |
| V18 | `AttentionMechanism` | Q·Kᵀ scores → softmax → weighted V mixing, token by token | "Attention Is All You Need" |
| V19 | `EmbeddingArithmetic` | king − man + woman ≈ queen; parallel capital-of arrows | embeddings, vector databases |
| V20 | `DiffusionProcess` | A structured point cloud noised to a Gaussian, then denoised back stepwise | DDPM/score-based models |
| V24 | `GraphBFS` | A wavefront floods a network level by level; shortest paths fall out of the parent pointers | graphs, crawlers, GC |
| V28 | `DifferentialDataflow` | Batch recomputes the world; differential ships (data, time, ±1) deltas and the frontier commits outputs | the DD lesson series |

## Architecture diagrams (`src/viz/arch/`) — the declarative primitive

`createArchDefinition(spec)` turns a **pure-data spec** into an animation: nodes
from a ~35-kind vocabulary (browser/mobile → CDN/DNS/ALB/API-gateway/edge-fn →
server/container/k8s/lambda/VM → DB/replica/cache/queue/topic/blob/search/
warehouse/vector-DB → auth/secrets/payments/external → metrics/logs/alerts/
repo/CI/artifact), containment **groups** (region/AZ/VPC/subnet/edge-network/
platform), edges, and **flows** — named request/response sequences that become
acts, with labeled pulses, arrival highlights, latency badges, node **failures**
(red ✕ + reroute) and recovery. Because a spec is just JSON-shaped data, a
small authoring model can produce a correct new architecture story by
pattern-matching the exemplars in `arch/catalog.ts`:

- `arch-cache-aside` — cold miss / warm hit / the invalidation trap
- `arch-aws-multi-az` — normal write w/ sync replication / AZ outage / failover
- `arch-vercel-edge` — edge hit / dynamic origin render / ISR regeneration

**Planned** — ordered roughly by (lesson value × reuse):

- *Linear algebra*: V4 change of basis
- *Optimization*: V10 saddle points & loss landscapes, V11 Lagrange multipliers,
  V12 learning-rate instability / divergence
- *Probability*: V15 MCMC random walk
- *ML / DL*: V21 transformer block residual stream, V22 LoRA low-rank update
  (builds on V3), V23 policy-gradient sketch
- *Graphs & systems*: V25 spectral clustering via the Laplacian, V26 DP table
  filling, V27 Raft leader election, V28 **differential dataflow progress
  tracking** (pairs with the existing DD lesson series)
- *Information theory*: V29 entropy & Huffman codes, V30 Hamming codes

## Using animations in lessons (the `viz` tool)

Every animation is registered in `src/viz/registry.ts` and cataloged in
`src/viz/manifest.mjs` (plain JS — the generator's validator imports it). A
lesson scene plays one act:

```js
{ id: 's2', focus: 'viz', narration: '…', say: '…',
  action: { tool: 'viz', animation: 'gradient-descent', act: 'momentum' } }
```

`src/panes/VizPane.tsx` renders the act deterministically from the lesson
clock — the narration MP3 paces the animation and scrubbing the lesson scrubs
the frame. Consecutive scenes play consecutive acts; the lesson's own `say`
lines replace the acts' built-in narration. Try it: `?sample=viz` on the dev
server. Authoring rules live in `generator/prompts/storyboard.txt` (THE VIZ
TOOL section + generated catalog); the validator (`generator/validate.mjs`)
rejects unknown animation ids and drops unknown act names with a warning.

**Adding an animation to the catalog:** export a `VizDefinition` from the
animation file, add it to `registry.ts`, add the matching entry to
`manifest.mjs`, and regenerate the catalog block in `storyboard.txt`. The
registry logs a loud dev-time error if the manifest and definitions drift.

## Adding a new animation

1. Copy the shape of `animations/LinearTransformation.tsx`: define `ACTS`, write
   `setup(ctx)` returning `draw(sample)`.
2. Use `theme.ts` colors by entity and `draw.ts` helpers; every foreground object
   gets a direct label.
3. Add `<Name>.stories.tsx` (fullscreen + dark background parameters).
4. Check it against the grammar above; scrub the whole timeline — no teleports.
