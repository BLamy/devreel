// Smoke test (not baked): can almostnode's terminal run VITEST? Route: ?sample=dd

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
  static fromArray(items) {
    const m = new Map()
    for (const x of items) bump(m, x, 1)
    return new Collection(consolidate(m))
  }
  entries() { return [...this.inner.values()].filter(([, c]) => c !== 0) }
  map(f) {
    const m = new Map()
    for (const [, [v, c]] of this.inner) bump(m, f(v), c)
    return new Collection(consolidate(m))
  }
}
`

const TEST = `import { describe, it, expect } from 'vitest'
import { Collection } from './src/collection.ts'

const show = (c) => c.entries().map(([v, m]) => JSON.stringify(v) + '=' + m).sort().join(' | ')

describe('Collection', () => {
  it('counts duplicates', () => {
    expect(show(Collection.fromArray(['a', 'a', 'b']))).toBe('"a"=2 | "b"=1')
  })
  it('map carries multiplicity', () => {
    expect(show(Collection.fromArray([1, 2]).map((n) => n * 2))).toBe('2=1 | 4=1')
  })
})
`

export const lesson = {
  slug: 'dd-smoke',
  title: 'DD smoke (vitest)',
  library: 'effect',
  throughline: 'smoke',
  workspace: {
    files: {
      '/src/collection.ts': COLLECTION,
      '/collection.test.ts': TEST,
      '/package.json': '{\n  "name": "dd",\n  "type": "module"\n}\n',
    },
  },
  scenes: [
    {
      id: 's1', chapter: 'Smoke', focus: 'terminal',
      narration: 'Run vitest.',
      autoAdvanceMs: 120000,
      action: { tool: 'terminal', run: 'npm i -D vitest@0.34.6 && vitest run', expect: 'passed' },
    },
  ],
}
