// Smoke test (not baked): verify the REAL library (Collection + Effect Ref-based
// countByKey) runs in almostnode's terminal. Route: ?sample=dd

const COLLECTION = `const keyOf = (value) => JSON.stringify(value)
function bump(m, value, delta) {
  const k = keyOf(value)
  const ex = m.get(k)
  m.set(k, [value, (ex ? ex[1] : 0) + delta])
}
function consolidate(m) {
  for (const [k, [, c]] of m) if (c === 0) m.delete(k)
  return m
}
export class Collection {
  constructor(inner) { this.inner = inner }
  static empty() { return new Collection(new Map()) }
  static fromArray(items) {
    const m = new Map()
    for (const x of items) bump(m, x, 1)
    return new Collection(consolidate(m))
  }
  static fromEntries(entries) {
    const m = new Map()
    for (const [x, c] of entries) bump(m, x, c)
    return new Collection(consolidate(m))
  }
  entries() { return [...this.inner.values()].filter(([, c]) => c !== 0) }
  add(value, mult) {
    const m = new Map(this.inner)
    bump(m, value, mult)
    return new Collection(consolidate(m))
  }
  map(f) {
    const m = new Map()
    for (const [, [v, c]] of this.inner) bump(m, f(v), c)
    return new Collection(consolidate(m))
  }
}
`

const OPERATOR = `import { Effect, Ref } from 'effect'
import { Collection } from './collection.ts'

export const countByKey = () =>
  Effect.gen(function* () {
    const counts = yield* Ref.make(new Map())
    return {
      step: (input) =>
        Ref.modify(counts, (state) => {
          const next = new Map(state)
          const delta = new Map()
          for (const [[key], mult] of input.entries()) {
            const k = JSON.stringify(key)
            const cur = delta.get(k) ?? { key, d: 0 }
            cur.d += mult
            delta.set(k, cur)
          }
          let out = Collection.empty()
          for (const [k, { key, d }] of delta) {
            if (d === 0) continue
            const prev = next.get(k)?.total ?? 0
            const after = prev + d
            if (prev !== 0) out = out.add([key, prev], -1)
            if (after !== 0) out = out.add([key, after], 1)
            if (after === 0) next.delete(k); else next.set(k, { key, total: after })
          }
          return [out, next]
        }),
    }
  })
`

const TEST = `import { Effect } from 'effect'
import { Collection } from './src/collection.ts'
import { countByKey } from './src/operator.ts'

const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg) }
const show = (c) => c.entries().map(([v, m]) => JSON.stringify(v) + '=' + m).sort().join(' | ')

const program = Effect.gen(function* () {
  const doubled = Collection.fromArray([1, 2, 3]).map((n) => n * 2)
  assert(show(doubled) === '2=1 | 4=1 | 6=1', 'map doubles')

  const count = yield* countByKey()
  const c1 = yield* count.step(Collection.fromEntries([[['eng', 'a'], 1], [['eng', 'b'], 1], [['sales', 'c'], 1]]))
  assert(show(c1) === '["eng",2]=1 | ["sales",1]=1', 'count initial eng=2 sales=1')

  console.log('✓ all tests passed')
})

Effect.runPromise(program).catch((e) => console.log('✗ ' + e.message))
`

export const lesson = {
  slug: 'dd-smoke',
  title: 'DD smoke',
  library: 'effect',
  throughline: 'smoke',
  workspace: {
    files: {
      '/src/collection.ts': COLLECTION,
      '/src/operator.ts': OPERATOR,
      '/test.ts': TEST,
      '/package.json': '{\n  "name": "dd",\n  "type": "module"\n}\n',
    },
  },
  scenes: [
    {
      id: 's1', chapter: 'Smoke', focus: 'terminal',
      narration: 'Install Effect and run the multi-file test.',
      autoAdvanceMs: 60000,
      action: { tool: 'terminal', run: 'npm install effect && node test.ts', expect: 'all tests passed' },
    },
  ],
}
