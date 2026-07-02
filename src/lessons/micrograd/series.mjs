// "Build micrograd in TypeScript" — Andrej Karpathy's tiny scalar autograd
// engine, ported faithfully to TypeScript and built from scratch across five
// short parts: the backprop idea (viz beat), the Value class, the backward
// pass, the neural-net layer on top, and a real training run in the terminal.
//
// Grounded in github.com/karpathy/micrograd (engine.py / nn.py / test_engine.py):
// same fields (data, grad, _backward, _prev, _op), same ops (add/mul/pow/relu +
// the sugar), same topo-sort backward, same Module/Neuron/Layer/MLP shapes.
// Numbers in the narration are real: the sanity check (y = −20, x.grad = 46)
// is micrograd's own PyTorch-verified test, and the seed-42 XOR run was
// executed ahead of time (loss 3.5539 → 0.0457 in 40 steps).
//
// almostnode constraint: relative imports use explicit `.ts` extensions.

const SERIES = 'Build micrograd in TypeScript'
const ACCENT = '#f59e0b'
const PKG = '{\n  "name": "micrograd-ts",\n  "type": "module"\n}\n'

const ed = (file, type, extra = {}) => ({ tool: 'editor', file, type, ...extra })
const lineOf = (text, needle) => text.split('\n').findIndex((l) => l.includes(needle)) + 1

function build(defs) {
  const files = {}
  return defs.map((def, i) => {
    const editorSeed = { ...files }
    for (const sc of def.scenes) {
      const a = sc.action
      if (a && a.tool === 'editor') {
        if (a.replace != null) files[a.file] = a.replace
        else if (a.type != null) files[a.file] = (files[a.file] ?? '') + a.type
      }
    }
    return {
      slug: def.slug,
      title: def.title,
      subtitle: def.subtitle,
      library: 'micrograd',
      throughline: 'the chain rule',
      persona: 'devreel',
      accent: ACCENT,
      format: 'video',
      series: SERIES,
      seriesOrder: i + 1,
      stage: def.stage,
      editorSeed,
      editorDefaultFile: def.file,
      workspace: { files: { ...files, '/package.json': PKG }, previewPort: 3000 },
      scenes: def.scenes,
    }
  })
}

const E = '/src/engine.ts'
const N = '/src/nn.ts'
const T = '/train.ts'

// ── train.ts, buggy + fixed versions (for the zero-grad bug beat) ──────────
const TRAIN_HEAD = `import { Value } from './src/engine.ts'
import { MLP } from './src/nn.ts'

// deterministic init so your run matches this video exactly
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// sanity check — ported from micrograd's own test suite (verified against PyTorch)
const x = new Value(-4.0)
const z = x.mul(2).add(2).add(x)
const q = z.relu().add(z.mul(x))
const h = z.mul(z).relu()
const y = h.add(q).add(q.mul(x))
y.backward()
console.log('sanity:', y.data === -20 && x.grad === 46 ? 'PASS' : 'FAIL')

// XOR — the classic dataset no straight line can separate
const rand = mulberry32(42)
const model = new MLP(2, [4, 1], rand)
const xs = [[0, 0], [0, 1], [1, 0], [1, 1]].map((row) => row.map((v) => new Value(v)))
const ys = [-1, 1, 1, -1]
`

const TRAIN_LOOP_BUGGY = `
let last = 0
for (let step = 0; step < 40; step++) {
  let loss = new Value(0)
  for (let i = 0; i < xs.length; i++) {
    const pred = model.call(xs[i])[0]
    loss = loss.add(pred.sub(ys[i]).pow(2))
  }
  loss.backward()
  for (const p of model.parameters()) p.data -= 0.05 * p.grad
  if (step % 5 === 0 || step === 39) console.log('step', step, 'loss', loss.data.toFixed(4))
  last = loss.data
}
console.log('trained:', last < 0.1 ? 'PASS' : 'FAIL')
`

const TRAIN_LOOP_FIXED = `
let last = 0
for (let step = 0; step < 40; step++) {
  let loss = new Value(0)
  for (let i = 0; i < xs.length; i++) {
    const pred = model.call(xs[i])[0]
    loss = loss.add(pred.sub(ys[i]).pow(2))
  }
  model.zeroGrad()
  loss.backward()
  for (const p of model.parameters()) p.data -= 0.05 * p.grad
  if (step % 5 === 0 || step === 39) console.log('step', step, 'loss', loss.data.toFixed(4))
  last = loss.data
}
console.log('trained:', last < 0.1 ? 'PASS' : 'FAIL')
`

const TRAIN_BUGGY = TRAIN_HEAD + TRAIN_LOOP_BUGGY
const TRAIN_FIXED = TRAIN_HEAD + TRAIN_LOOP_FIXED

export const parts = build([
  // ── Part 1 — the idea (viz beat: backprop end to end) ────────────────────
  {
    slug: 'micrograd-01-backprop',
    title: 'What is backpropagation?',
    subtitle: 'The idea behind micrograd, in one picture',
    file: E,
    scenes: [
      {
        id: 's1', chapter: 'The network', focus: 'viz',
        narration: "We're going to build **micrograd** — Karpathy's tiny autograd engine — in TypeScript, from scratch.",
        say: "Welcome. Over this series we are going to build micrograd — Andrej Karpathy's tiny automatic differentiation engine — in TypeScript, from scratch, and train a real neural network with it. First, the idea we are chasing. Here is a small network: circles are numbers, edges are weights.",
        cue: 'Here is a small network',
        action: { tool: 'viz', animation: 'neural-network', act: 'the network' },
      },
      {
        id: 's2', chapter: 'Forward', focus: 'viz',
        narration: 'The **forward pass**: inputs flow left to right — weighted sums, then activations.',
        say: "The forward pass. Inputs flow left to right. Every neuron takes a weighted sum of the previous layer and pushes it through an activation. Nothing but multiplies, adds, and a squashing function.",
        cue: 'Inputs flow left to right',
        action: { tool: 'viz', animation: 'neural-network', act: 'forward pass' },
      },
      {
        id: 's3', chapter: 'The loss', focus: 'viz',
        narration: 'The output is a **guess**; the *loss* measures how wrong it is.',
        say: "At the end comes a guess, and the loss measures how wrong that guess is. One single number that summarizes our embarrassment. Training means making that number smaller.",
        cue: 'summarizes our embarrassment',
        action: { tool: 'viz', animation: 'neural-network', act: 'prediction vs target' },
      },
      {
        id: 's4', chapter: 'Backward', focus: 'viz',
        narration: '**Backpropagation**: the error flows backwards, and every weight learns its share of the blame — via the *chain rule*.',
        say: "And here is the trick the whole field runs on. The error flows backwards through the same graph, and every single weight receives exactly its share of the blame. That is the chain rule from calculus, applied mechanically, node by node.",
        cue: 'exactly its share of the blame',
        action: { tool: 'viz', animation: 'neural-network', act: 'backpropagation' },
      },
      {
        id: 's5', chapter: 'The plan', focus: 'viz',
        narration: 'Nudge each weight against its gradient, and the loss drops. **micrograd computes those gradients — in ~100 lines.** Let’s build it.',
        say: "Nudge every weight a tiny step against its gradient, and the loss drops. The machinery that computes those gradients — for any expression you can write — is micrograd, and the entire engine is about a hundred lines. Next part, we start typing it.",
        cue: 'about a hundred lines',
        action: { tool: 'viz', animation: 'neural-network', act: 'one gradient step' },
      },
    ],
  },

  // ── Part 2 — the Value class (engine.ts, part 1) ──────────────────────────
  {
    slug: 'micrograd-02-value',
    title: 'The Value class',
    subtitle: 'One scalar, its gradient, and the graph',
    file: E,
    stage: { editor: 1, mobileEditor: 1 },
    scenes: [
      {
        id: 's1', chapter: 'Value', focus: 'editor',
        narration: 'A `Value` carries `grad` — the gradient we’ll compute — and `_backward`, a closure that knows how to push gradient to its inputs.',
        say: "Everything in micrograd is a Value: a box around one scalar number. Two fields up front. grad is the derivative of the final loss with respect to this value — it starts at zero, because we haven't computed anything yet. And underscore backward is a little function that will know how to push gradient from this node back into its inputs. For a plain Value, it defaults to doing nothing.",
        cue: 'a box around one scalar number',
        action: ed(E, 'export class Value {\n  grad = 0\n  _backward = () => {}\n\n'),
      },
      {
        id: 's3', chapter: 'Constructor', focus: 'editor',
        narration: 'The constructor: store the number (`data`), remember the inputs that made it (`_prev`), and how (`_op`).',
        say: "The constructor takes the number itself — data — plus an optional list of children, the inputs that made this value, and a label for which operation made it. It stores the data, wraps the children in a Set called underscore prev, and keeps the label as underscore op. Every Value remembers the expression graph that built it — and that is the entire data structure.",
        cue: 'the entire data structure',
        action: ed(E, "  constructor(data, children = [], op = '') {\n    this.data = data\n    this._prev = new Set(children)\n    this._op = op\n  }\n\n"),
      },
      {
        id: 's4', chapter: 'add', focus: 'editor',
        narration: '`add`: compute `data + data`, and record that **we** are the parents (`[this, o]`, op `+`).',
        say: "Now the first operation: add. If the other operand is a plain number we wrap it in a Value first. Then we build the output: its data is just the two datas added — but crucially, we record this and o as its children, with op plus. We are building the graph as a side effect of doing the math.",
        cue: 'building the graph as a side effect',
        action: ed(E, "  add(other) {\n    const o = other instanceof Value ? other : new Value(other)\n    const out = new Value(this.data + o.data, [this, o], '+')\n"),
      },
      {
        id: 's5', chapter: 'add backward', focus: 'editor',
        narration: 'Addition **routes gradient through unchanged** — and we `+=` (accumulate!), because a Value can be used twice.',
        say: "And here is add's backward rule. The derivative of a sum with respect to either input is one — so whatever gradient the output has, both inputs receive it unchanged. Notice it is plus equals, not equals. If the same Value is used in two places, both paths must add up. Assigning instead of accumulating is the classic autograd bug.",
        cue: 'plus equals, not equals',
        action: ed(E, '    out._backward = () => {\n      this.grad += out.grad\n      o.grad += out.grad\n    }\n    return out\n  }\n\n'),
      },
      {
        id: 's6', chapter: 'mul', focus: 'editor',
        narration: '`mul`: same shape — multiply the datas, record the parents with op `*`.',
        say: "Multiplication has exactly the same shape. Wrap the operand if needed, multiply the two datas, and record both inputs as children with op star.",
        cue: 'exactly the same shape',
        action: ed(E, "  mul(other) {\n    const o = other instanceof Value ? other : new Value(other)\n    const out = new Value(this.data * o.data, [this, o], '*')\n"),
      },
      {
        id: 's7', chapter: 'mul backward', focus: 'editor',
        narration: 'The product rule: each input’s gradient is **the *other* input’s data** times `out.grad`. The class stays open — backward pass next.',
        say: "But multiplication's backward rule is where calculus first shows up. The derivative of a times b with respect to a — is b. So each input receives the other input's data, times the gradient flowing in from the output. That one line is the chain rule in miniature. We'll leave the class open here; next part we add powers, relu, and the backward pass that walks the whole graph.",
        cue: 'the chain rule in miniature',
        action: ed(E, '    out._backward = () => {\n      this.grad += o.data * out.grad\n      o.grad += this.data * out.grad\n    }\n    return out\n  }\n\n'),
      },
    ],
  },

  // ── Part 3 — the backward pass (engine.ts, part 2) ────────────────────────
  {
    slug: 'micrograd-03-backward',
    title: 'The backward pass',
    subtitle: 'pow, relu, and the topological walk',
    file: E,
    stage: { editor: 1, mobileEditor: 1 },
    scenes: [
      {
        id: 's1', chapter: 'pow', focus: 'editor',
        narration: '`pow`: the power rule — `n · xⁿ⁻¹` — times the incoming gradient.',
        say: "Let's finish the engine. pow raises a Value to a plain number exponent. Its backward rule is the power rule from high school calculus: n times x to the n minus one, times the gradient flowing in. We will use pow of two for the loss, and pow of minus one for division.",
        cue: 'the power rule',
        action: ed(E, "  pow(n) {\n    const out = new Value(this.data ** n, [this], '**' + n)\n    out._backward = () => {\n      this.grad += n * this.data ** (n - 1) * out.grad\n    }\n    return out\n  }\n\n"),
      },
      {
        id: 's2', chapter: 'relu', focus: 'editor',
        narration: '`relu`: clamp negatives to 0. Backward: gradient passes **only where the output was positive** — a gate.',
        say: "relu is the nonlinearity — if the data is negative, the output is zero, otherwise it passes through. Its backward rule is a gate: if the output was positive, gradient flows through untouched; if the output was zero, nothing flows at all. Dead simple, and it is what lets networks bend.",
        cue: 'gradient flows through untouched',
        action: ed(E, "  relu() {\n    const out = new Value(this.data < 0 ? 0 : this.data, [this], 'ReLU')\n    out._backward = () => {\n      this.grad += (out.data > 0 ? 1 : 0) * out.grad\n    }\n    return out\n  }\n\n"),
      },
      {
        id: 's3', chapter: 'Sugar', focus: 'editor',
        narration: '`neg` and `sub` are **free**: built from `mul` and `add`, so their gradients come for free too.',
        say: "Negation and subtraction cost us nothing. neg is just multiply by minus one, and sub is add the negation. Because they are built from ops that already know their derivatives, their gradients come for free. This is the deep trick of autograd: compose a few primitives, and everything downstream is differentiable.",
        cue: 'their gradients come for free',
        action: ed(E, '  neg() {\n    return this.mul(-1)\n  }\n\n  sub(other) {\n    return this.add(other instanceof Value ? other.neg() : -other)\n  }\n\n'),
      },
      {
        id: 's4', chapter: 'div', focus: 'editor',
        narration: '`div` too: `a / b` is just `a · b⁻¹`.',
        say: "Division, same story: a divided by b is a times b to the power of minus one. pow already knows how to differentiate that.",
        cue: 'Division, same story',
        action: ed(E, '  div(other) {\n    const o = other instanceof Value ? other : new Value(other)\n    return this.mul(o.pow(-1))\n  }\n\n'),
      },
      {
        id: 's5', chapter: 'Topo sort', focus: 'editor',
        narration: '`backward()` step 1: a **topological sort** — visit children first, so every node comes *after* everything it depends on.',
        say: "Now the finale: backward. Before we can apply the chain rule we need an order. This little depth-first walk visits each node once, recurses into its children first, and only then appends the node — a topological sort. Every node lands after everything it depends on.",
        cue: 'a topological sort',
        action: ed(E, '  backward() {\n    const topo = []\n    const visited = new Set()\n    const build = (v) => {\n      if (visited.has(v)) return\n      visited.add(v)\n      for (const child of v._prev) build(child)\n      topo.push(v)\n    }\n    build(this)\n'),
      },
      {
        id: 's6', chapter: 'Chain rule', focus: 'editor',
        narration: 'Step 2: seed `this.grad = 1`, walk the list **in reverse**, and let each node’s `_backward` push gradient to its inputs. Engine done.',
        say: "Then three lines finish the entire engine. Seed the output's own gradient to one — the loss changes one for one with itself. Walk the topological order in reverse, from the output back toward the leaves. And at each node, call its underscore backward, which pushes gradient one edge deeper. That's backpropagation. The whole thing.",
        cue: "That's backpropagation",
        action: ed(E, '    this.grad = 1\n    for (const v of topo.reverse()) v._backward()\n  }\n}\n'),
      },
    ],
  },

  // ── Part 4 — neurons, layers, MLP (nn.ts) ─────────────────────────────────
  {
    slug: 'micrograd-04-nn',
    title: 'Neurons, Layers, MLP',
    subtitle: 'A neural net library in 50 lines',
    file: N,
    stage: { editor: 1, mobileEditor: 1 },
    scenes: [
      {
        id: 's1', chapter: 'Module', focus: 'editor',
        narration: 'A base `Module`: `parameters()` lists trainable Values; `zeroGrad()` resets their gradients. (Note the explicit `.ts` import.)',
        say: "New file: the neural net library, importing Value from the engine — note the explicit dot t s extension, which this runtime requires. Module is the tiny base class: parameters returns every trainable Value, and zeroGrad walks them and resets each gradient to zero. Remember that gradients accumulate — this reset will matter more than it looks.",
        cue: 'this reset will matter',
        action: ed(N, "import { Value } from './engine.ts'\n\nexport class Module {\n  zeroGrad() {\n    for (const p of this.parameters()) p.grad = 0\n  }\n  parameters() {\n    return []\n  }\n}\n\n"),
      },
      {
        id: 's2', chapter: 'Neuron', focus: 'editor',
        narration: 'A `Neuron`: `nin` random weights in ±1, a bias at 0. The `rand` parameter keeps runs **reproducible**.',
        say: "A Neuron holds one weight per input, initialized uniformly between minus one and one, plus a bias starting at zero. Two small notes: nonlin decides whether it applies relu, and we accept the random function as a parameter — pass a seeded one and every run of this series reproduces exactly.",
        cue: 'one weight per input',
        action: ed(N, 'export class Neuron extends Module {\n  b = new Value(0)\n\n  constructor(nin, nonlin = true, rand = Math.random) {\n    super()\n    this.w = Array.from({ length: nin }, () => new Value(rand() * 2 - 1))\n    this.nonlin = nonlin\n  }\n\n'),
      },
      {
        id: 's3', chapter: 'Forward', focus: 'editor',
        narration: '`call(x)`: the weighted sum `Σ wᵢ·xᵢ + b`, then `relu`. **Every step builds the graph** — so backprop through a neuron is already done.',
        say: "Calling the neuron is the weighted sum: start from the bias, and for each input, add weight i times x i. Then relu, unless this is a linear output neuron. Look at what we did not write: any backward logic. Every add and mul here is a Value operation, so the expression graph — and therefore backprop — comes along automatically.",
        cue: 'comes along automatically',
        action: ed(N, '  call(x) {\n    let act = this.b\n    for (let i = 0; i < this.w.length; i++) act = act.add(this.w[i].mul(x[i]))\n    return this.nonlin ? act.relu() : act\n  }\n\n  parameters() {\n    return [...this.w, this.b]\n  }\n}\n\n'),
      },
      {
        id: 's4', chapter: 'Layer', focus: 'editor',
        narration: 'A `Layer` is just **nout neurons side by side**, each seeing the same input.',
        say: "A Layer is nothing clever: n out independent neurons, each looking at the same input vector. Calling it maps the input through every neuron, and its parameters are all of theirs flattened together.",
        cue: 'independent neurons',
        action: ed(N, 'export class Layer extends Module {\n  constructor(nin, nout, nonlin = true, rand = Math.random) {\n    super()\n    this.neurons = Array.from({ length: nout }, () => new Neuron(nin, nonlin, rand))\n  }\n\n  call(x) {\n    return this.neurons.map((n) => n.call(x))\n  }\n\n  parameters() {\n    return this.neurons.flatMap((n) => n.parameters())\n  }\n}\n\n'),
      },
      {
        id: 's5', chapter: 'MLP', focus: 'editor',
        narration: 'An `MLP` chains layers: sizes like `(2, [4, 1])`. The **last layer stays linear** (`i !== nouts.length - 1`).',
        say: "And the multi-layer perceptron chains layers. You give it the input size and a list of layer sizes — two inputs, then four hidden, then one output. The one subtlety is that the final layer is linear: the comparison i not equal to the last index switches relu off there, so the output can be any number, not just positives.",
        cue: 'the final layer is linear',
        action: ed(N, 'export class MLP extends Module {\n  constructor(nin, nouts, rand = Math.random) {\n    super()\n    const sz = [nin, ...nouts]\n    this.layers = sz.slice(0, -1).map((_, i) => new Layer(sz[i], sz[i + 1], i !== nouts.length - 1, rand))\n  }\n\n'),
      },
      {
        id: 's6', chapter: 'Done', focus: 'editor',
        narration: '`call` feeds each layer’s output to the next. That’s the whole library — **a trainable neural net over our 100-line engine.**',
        say: "Calling the MLP just threads the data through: each layer's output becomes the next layer's input. And with that, the library is done — a genuinely trainable neural network, sitting on top of our hundred-line engine. Next part: we train it, live, in the terminal.",
        cue: 'the library is done',
        action: ed(N, '  call(x) {\n    let out = x\n    for (const layer of this.layers) out = layer.call(out)\n    return out\n  }\n\n  parameters() {\n    return this.layers.flatMap((l) => l.parameters())\n  }\n}\n'),
      },
    ],
  },

  // ── Part 5 — train it (viz beat + train.ts + terminal) ────────────────────
  {
    slug: 'micrograd-05-training',
    title: 'Train it on XOR',
    subtitle: 'Gradient descent, a classic bug, and a live run',
    file: T,
    stage: { editor: 0.6, mobileEditor: 0.68 },
    scenes: [
      {
        id: 's1', chapter: 'The landscape', focus: 'viz',
        narration: 'Training = descending the **loss landscape**. Our engine computes the slope; the step is ours to take.',
        say: "One more picture before we type. The loss, as a function of the weights, is a landscape. Training is descending it. Our engine's job is to compute the slope under our feet — the gradient. The step is ours to take.",
        cue: 'compute the slope under our feet',
        action: { tool: 'viz', animation: 'gradient-descent', act: 'the loss landscape' },
      },
      {
        id: 's2', chapter: 'Descent', focus: 'viz',
        narration: 'Follow `−∇loss` in tiny steps: **gradient descent** — exactly the loop we’re about to write.',
        say: "Follow the negative gradient in tiny steps, and you roll downhill. That is gradient descent — and it is exactly, literally, the loop we are about to write.",
        cue: 'exactly, literally, the loop',
        action: { tool: 'viz', animation: 'gradient-descent', act: 'gradient descent' },
      },
      {
        id: 's3', chapter: 'Setup', focus: 'editor',
        narration: 'Imports, a **seeded** random (mulberry32, seed 42), and micrograd’s own **sanity check**: after `backward()`, `x.grad` must be exactly **46**.',
        say: "The training script. We import the engine and the MLP, and define a tiny seeded random generator so your run matches this video number for number. Then a sanity check ported straight from micrograd's own test suite: build this gnarly expression from x equals minus four, run backward, and x's gradient must come out exactly forty six — the value PyTorch computes. If this prints PASS, our chain rule is right.",
        cue: 'exactly forty six',
        action: ed(T, TRAIN_HEAD),
      },
      {
        id: 's4', chapter: 'The loop', focus: 'editor',
        narration: 'XOR data (targets ±1), `MLP(2, [4, 1])` — 17 parameters. Loop: forward → squared-error loss → `backward()` → step **against** the gradient.',
        say: "The data is XOR: four points, targets minus one or plus one — famously impossible for a single straight line. The model is an MLP with two inputs, four hidden neurons, one output: seventeen parameters. And the loop: forward every point, sum the squared errors into one loss, call backward, then nudge every parameter a small step against its gradient.",
        cue: 'famously impossible',
        action: ed(T, TRAIN_LOOP_BUGGY, {
          diagnostics: [{
            line: lineOf(TRAIN_BUGGY, 'loss.backward()'),
            message: "gradients accumulate: grads from step 1 are still in the params at step 2 — call zeroGrad() before backward()",
            severity: 'warning',
          }],
        }),
      },
      {
        id: 's5', chapter: 'The bug', focus: 'editor',
        narration: '⚠️ **The classic bug**: `grad` *accumulates* (`+=`). Without `zeroGrad()` every step adds to stale gradients — the loss bounces instead of falling (it ends at 0.47: FAIL).',
        say: "But there is a bug in that loop, and it is the most classic one in all of deep learning. Remember: every backward rule accumulates with plus equals. That is correct within one backward pass — but between steps, the old gradients are still sitting in the parameters. Run it like this and the loss falls at first, then bounces — point one seven, up to one point one, never settling, and the run ends in FAIL. One line fixes it: zero grad, right before backward.",
        cue: 'the old gradients are still sitting',
        action: ed(T, undefined, {
          replace: TRAIN_FIXED,
          reveal: [lineOf(TRAIN_FIXED, 'model.zeroGrad()') - 3, lineOf(TRAIN_FIXED, 'model.zeroGrad()') + 3],
        }),
      },
      {
        id: 's6', chapter: 'Run it', focus: 'terminal',
        narration: 'The run: **sanity PASS**, then the loss falls `3.55 → 0.05` in 40 steps. XOR — learned by an engine we wrote from scratch.',
        say: "Moment of truth. We run the script with node. The sanity check passes — our gradients match PyTorch. And then watch the loss: three point five five, falling step by step to zero point zero five by step thirty nine. Trained: PASS. That is XOR, learned by gradient descent, on an autograd engine we wrote from scratch. That's micrograd.",
        cue: 'Moment of truth',
        action: { tool: 'terminal', run: 'node train.ts', expect: 'trained: PASS' },
      },
    ],
  },
])
