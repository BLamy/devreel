// "Differential Dataflow in Effect" — a long series that builds a small but real
// incremental dataflow library across short parts, then runs its tests at the CLI.
//
// Each part is authored as scenes; editor scenes carry a `type` segment. The
// builder accumulates file contents across parts so every part's `editorSeed` is
// the code from all PRIOR parts and `workspace.files` is the code through THIS
// part. The final part's accumulated code === the library we verified in Node.
//
// almostnode constraint: relative imports in lesson code use explicit `.ts`
// extensions (the node runtime doesn't infer them). See [[almostnode-embedding]].

const SERIES = 'Differential Dataflow in Effect'
const ACCENT = '#a21caf'
const PKG = '{\n  "name": "diff-dataflow",\n  "type": "module"\n}\n'

const ed = (file, type, extra = {}) => ({ tool: 'editor', file, type, ...extra })

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
      library: 'effect',
      throughline: 'differential dataflow',
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

const C = '/src/collection.ts'
const CT = '/collection.test.ts'

export const parts = build([
  // ── Part 1 — the idea (a pure viz beat: the 3b1b explainer) ───────────────
  {
    slug: 'dd-01-intro',
    title: 'What is differential dataflow?',
    subtitle: 'Work proportional to change, not data',
    file: C,
    scenes: [
      {
        id: 's1', chapter: 'The idea', focus: 'viz',
        narration: 'A computation is a **pipeline**: records flow through operators into a live result.',
        say: "Welcome. Over this series we are going to build a small differential dataflow engine in Effect, from scratch, and run its tests. First, the idea itself. Think of a computation as a pipeline: records flow in, pass through operators, and a result collects on the other side.",
        cue: 'think of a computation as a pipeline',
        action: { tool: 'viz', animation: 'differential-dataflow', act: 'a dataflow' },
      },
      {
        id: 's2', chapter: 'The batch trap', focus: 'viz',
        narration: 'One new record arrives… and **batch** recomputes *everything*.',
        say: "Now one new record arrives. The traditional batch answer is brutal: throw the result away and recompute everything, all ten thousand records, for one change.",
        cue: 'throw the result away',
        action: { tool: 'viz', animation: 'differential-dataflow', act: 'the batch way' },
      },
      {
        id: 's3', chapter: 'Diffs', focus: 'viz',
        narration: 'Differential ships **differences**: `(data, time, +1)` — never whole snapshots.',
        say: "Differential dataflow refuses. It represents a collection as changes: this record, plus one. Only the difference flows through the pipeline, and the result just adjusts. Work done: one record.",
        cue: 'only the difference flows',
        action: { tool: 'viz', animation: 'differential-dataflow', act: 'differences, not snapshots' },
      },
      {
        id: 's4', chapter: 'The frontier', focus: 'viz',
        narration: 'Changes carry **timestamps**; the *frontier* proves when an answer is complete — even with **retractions** (−1).',
        say: "With changes streaming in, including retractions — minus one — when is an answer safe to show? Every change carries a timestamp, and the frontier is the system's proof that no earlier input can still arrive. Outputs commit exactly when the frontier passes them.",
        cue: 'when is an answer safe',
        action: { tool: 'viz', animation: 'differential-dataflow', act: 'timestamps and the frontier' },
      },
      {
        id: 's5', chapter: 'Why it matters', focus: 'viz',
        narration: 'Batch: work ∝ **data**. Differential: work ∝ **change**. Let’s build it.',
        say: "That is the whole trade. Batch does work proportional to your data; differential does work proportional to your change. When data is huge and changes are tiny, that is not a little faster — it is a different sport. Let's go build one: a multiset of values with integer counts, where negative counts are retractions.",
        cue: 'proportional to your change',
        action: { tool: 'viz', animation: 'differential-dataflow', act: 'why it scales' },
      },
    ],
  },

  // ── Part 2 — the multiset (collection.ts, part 1) ─────────────────────────
  {
    slug: 'dd-02-collection-core',
    title: 'The Collection type',
    subtitle: 'A multiset keyed by value',
    file: C,
    scenes: [
      {
        id: 's1', chapter: 'Keying', focus: 'editor',
        narration: 'Values can be objects, so we key the multiset by a stable string — `JSON.stringify`.',
        say: "We will store the multiset in a Map, but values can be objects, and objects are compared by reference. So we need a stable string key. keyOf turns any value into its JSON string, so two equal records map to the same key.",
        cue: 'a stable string key',
        action: ed(C, 'const keyOf = (value) => JSON.stringify(value)\n\n'),
      },
      {
        id: 's2', chapter: 'bump', focus: 'editor',
        narration: '`bump` adds `delta` to a value’s count in a map (creating it at 0 first).',
        say: "Next, a helper called bump. Given a map, a value, and a delta, it looks up the value's current entry by key, defaults the count to zero if it is missing, and stores the value together with its count plus the delta. This is how we add or subtract multiplicities in one place.",
        cue: 'a helper called bump',
        action: ed(C, 'function bump(m, value, delta) {\n  const k = keyOf(value)\n  const existing = m.get(k)\n  m.set(k, [value, (existing ? existing[1] : 0) + delta])\n}\n\n'),
      },
      {
        id: 's3', chapter: 'consolidate', focus: 'editor',
        narration: '`consolidate` drops any value whose count reached **0** — an empty entry isn’t there at all.',
        say: "Then consolidate. After arithmetic, some counts land on zero, and a zero count means the value is simply not present. So consolidate walks the map and deletes every entry whose count is zero. We will call this after every operation to keep collections tidy.",
        cue: 'drops any value whose count',
        action: ed(C, 'function consolidate(m) {\n  for (const [k, [, count]] of m) if (count === 0) m.delete(k)\n  return m\n}\n\n'),
      },
      {
        id: 's4', chapter: 'The class', focus: 'editor',
        narration: 'A `Collection` just wraps that inner map. It’s **immutable** — every operation returns a new one.',
        say: "Now the Collection class itself. It simply wraps the inner map. The constructor stores it. Notice the design: collections are immutable. Every operation will return a brand new Collection rather than mutating in place, which keeps diffs predictable.",
        cue: 'wraps that inner map',
        action: ed(C, 'export class Collection {\n  constructor(inner) {\n    this.inner = inner\n  }\n\n'),
      },
      {
        id: 's5', chapter: 'empty', focus: 'editor',
        narration: '`Collection.empty()` — the starting point, an empty map.',
        say: "A static empty factory returns a Collection wrapping a fresh empty map. This is our identity value, the starting point we fold changes into.",
        cue: 'static empty factory',
        action: ed(C, '  static empty() {\n    return new Collection(new Map())\n  }\n\n'),
      },
      {
        id: 's6', chapter: 'fromArray', focus: 'editor',
        narration: '`fromArray` counts each item once — duplicates become higher multiplicities.',
        say: "fromArray builds a collection from a plain array. We make a map, then for each item we bump its count by one. Duplicates naturally fold into a higher multiplicity. Finally we consolidate and wrap it. That is how three apples becomes apple times three.",
        cue: 'builds a collection from a plain array',
        action: ed(C, '  static fromArray(items) {\n    const m = new Map()\n    for (const x of items) bump(m, x, 1)\n    return new Collection(consolidate(m))\n  }\n\n'),
      },
      {
        id: 's7', chapter: 'fromEntries', focus: 'editor',
        narration: '`fromEntries` takes explicit `[value, count]` pairs — perfect for writing **diffs** by hand.',
        say: "fromEntries is similar but takes explicit value and multiplicity pairs. We bump each value by its given count. This one is how we will hand-write diffs in our tests, including negative counts for retractions.",
        cue: 'explicit value and multiplicity pairs',
        action: ed(C, '  static fromEntries(entries) {\n    const m = new Map()\n    for (const [value, mult] of entries) bump(m, value, mult)\n    return new Collection(consolidate(m))\n  }\n\n'),
      },
      {
        id: 's8', chapter: 'entries', focus: 'editor',
        narration: 'And `entries()` reads back the non-zero `[value, count]` pairs. More methods next part.',
        say: "Finally for now, entries reads the contents back out: the values of the inner map, filtered to drop anything that is somehow zero. Notice we have left the class open — in the next part we add the operations that actually transform collections.",
        cue: 'reads the contents back out',
        action: ed(C, '  entries() {\n    return [...this.inner.values()].filter(([, count]) => count !== 0)\n  }\n'),
      },
    ],
  },

  // ── Part 3 — operations (collection.ts, part 2) ───────────────────────────
  {
    slug: 'dd-03-collection-ops',
    title: 'Collection operations',
    subtitle: 'add, concat, negate, map, filter',
    file: C,
    scenes: [
      {
        id: 's1', chapter: 'add', focus: 'editor',
        narration: '`add` returns a **new** collection with `mult` added to one value (copying the map first).',
        say: "Let's finish the class. add takes a value and a multiplicity and returns a new collection. We copy the inner map so the original is untouched, bump the value by the multiplicity, consolidate, and wrap. Immutability in action.",
        cue: 'returns a new collection',
        action: ed(C, '  add(value, mult) {\n    const m = new Map(this.inner)\n    bump(m, value, mult)\n    return new Collection(consolidate(m))\n  }\n\n'),
      },
      {
        id: 's2', chapter: 'concat', focus: 'editor',
        narration: '`concat` merges two collections by **summing** multiplicities.',
        say: "concat merges two collections. We copy our map, then for every value and count in the other collection, we bump it in. Equal values add their counts together. This is the union of multisets, and it is also how we apply a diff: concatenating a change onto the current state.",
        cue: 'merges two collections',
        action: ed(C, '  concat(other) {\n    const m = new Map(this.inner)\n    for (const [, [value, count]] of other.inner) bump(m, value, count)\n    return new Collection(consolidate(m))\n  }\n\n'),
      },
      {
        id: 's3', chapter: 'negate', focus: 'editor',
        narration: '`negate` flips every count — turning a collection into its **retraction**.',
        say: "negate flips the sign of every multiplicity. A collection of additions becomes a collection of retractions. We will use this to express removals: negate, then concat, undoes exactly what was there.",
        cue: 'flips the sign',
        action: ed(C, '  negate() {\n    const m = new Map()\n    for (const [k, [value, count]] of this.inner) m.set(k, [value, -count])\n    return new Collection(m)\n  }\n\n'),
      },
      {
        id: 's4', chapter: 'map', focus: 'editor',
        narration: '`map` transforms each value, **carrying its count along**.',
        say: "Now the interesting ones. map applies a function to each value, carrying its count along, bumping the result into a new map. Here is the crucial property: map is linear. Because each input contributes independently, applying map to a diff gives exactly the diff of the output. That is why map needs no state to run incrementally.",
        cue: 'map applies a function',
        action: ed(C, '  map(f) {\n    const m = new Map()\n    for (const [, [value, count]] of this.inner) bump(m, f(value), count)\n    return new Collection(consolidate(m))\n  }\n\n'),
      },
      {
        id: 's5', chapter: 'filter', focus: 'editor',
        narration: '`filter` keeps values passing a predicate, with their counts — and closes the class.',
        say: "filter keeps only values that pass a predicate, with their counts intact, and drops the rest. Like map, it is linear and works directly on diffs. With the closing brace, our Collection is complete. Next, let's prove it works in the terminal.",
        cue: 'keeps only values that pass',
        action: ed(C, '  filter(pred) {\n    const m = new Map()\n    for (const [, [value, count]] of this.inner) if (pred(value)) bump(m, value, count)\n    return new Collection(consolidate(m))\n  }\n}\n'),
      },
    ],
  },

  // ── Part 4 — first test at the CLI (collection.test.ts) ───────────────────
  {
    slug: 'dd-04-collection-test',
    title: 'Test it in the terminal',
    subtitle: 'A real multi-file run',
    file: CT,
    stage: { editor: 0.64, mobileEditor: 0.6 },
    scenes: [
      {
        id: 's1', chapter: 'New file', focus: 'editor',
        narration: 'A new file, `collection.test.ts`. We import `Collection` — note the explicit `.ts`.',
        say: "Let's write a test in a new file, collection dot test dot ts. We import Collection from our source file. One thing to notice: when we run this with node, relative imports need the explicit dot ts extension, so we write collection dot ts in the path.",
        cue: 'a new file',
        action: ed(CT, "import { Collection } from './src/collection.ts'\n\n"),
      },
      {
        id: 's2', chapter: 'Helper', focus: 'editor',
        narration: 'A `show` helper renders a collection as sorted `value=count` text.',
        say: "A small show helper turns a collection into readable text: for each value and multiplicity it prints the value as JSON, an equals sign, and the count, then sorts them so the output is stable. Pure formatting.",
        cue: 'a small show helper',
        action: ed(CT, "const show = (c) =>\n  c.entries().map(([v, m]) => JSON.stringify(v) + '=' + m).sort().join(' | ')\n\n"),
      },
      {
        id: 's3', chapter: 'Build one', focus: 'editor',
        narration: 'Build a multiset of fruit — `apple` appears twice, so its count is 2.',
        say: "Now the actual test. We build a collection from an array with two apples and one pear, and log it. Because fromArray folds duplicates, we expect apple equals two and pear equals one.",
        cue: 'a collection from an array',
        action: ed(CT, "const fruit = Collection.fromArray(['apple', 'apple', 'pear'])\nconsole.log('fruit:', show(fruit))\n\n"),
      },
      {
        id: 's4', chapter: 'Transform', focus: 'editor',
        narration: 'Chain `map` then `filter` — uppercase, then keep names longer than 4.',
        say: "Then we chain our linear operators: map each name to upper case, then filter to names longer than four letters. APPLE has five letters and keeps its count of two; PEAR has four and is dropped. We log the result.",
        cue: 'chain our linear operators',
        action: ed(CT, "const big = fruit.map((s) => s.toUpperCase()).filter((s) => s.length > 4)\nconsole.log('big:', show(big))\n\n"),
      },
      {
        id: 's5', chapter: 'Assert', focus: 'editor',
        narration: 'Assert both results and print **PASS** or **FAIL**.',
        say: "Finally we assert: fruit should be apple two, pear one, and big should be APPLE two. If both hold we print PASS, otherwise FAIL. A tiny but real test.",
        cue: 'we assert',
        action: ed(CT, "const ok = show(fruit) === '\"apple\"=2 | \"pear\"=1' && show(big) === '\"APPLE\"=2'\nconsole.log(ok ? 'PASS ✓' : 'FAIL ✗')\n"),
      },
      {
        id: 's6', chapter: 'Run it', focus: 'terminal',
        narration: 'Run it with Node — multiset counting and our linear ops, working.',
        say: "And we run it with node collection dot test dot ts. There it is: apple two, pear one; APPLE two; and PASS. Our multiset and its linear operators work. Next part, we make these operators incremental with Effect.",
        cue: 'run it with node',
        action: { tool: 'terminal', run: 'node collection.test.ts', expect: 'PASS' },
      },
    ],
  },
])
