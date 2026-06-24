// A basic Effect (effect-ts) program lesson.
// Bake:  node generator/cli.mjs --lesson src/lessons/effect-basics.lesson.mjs
//
// The preview runs Effect for real, loaded from esm.sh by URL (like React/PGlite/
// Eruda elsewhere), so the editor types real Effect code and the live preview
// executes it. Grounded in real Effect v3 APIs: Effect.succeed, pipe, Effect.map,
// Effect.runSync.

const IMPORTS =
  "import React from 'react'\n" +
  "import { Effect, pipe } from 'https://esm.sh/effect@3'\n\n"

const PROGRAM =
  "const program = pipe(\n" +
  "  Effect.succeed(21),\n" +
  "  Effect.map((n) => n * 2),\n" +
  ")\n\n"

const COMPONENT =
  "export default function App() {\n" +
  "  const result = Effect.runSync(program)\n" +
  "  return (\n" +
  '    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">\n' +
  '      <h1 className="text-2xl font-bold">Effect basics</h1>\n' +
  '      <p className="mt-2 text-slate-600">An Effect is a description. runSync executes it.</p>\n' +
  '      <p className="mt-4 text-3xl font-bold">result = {result}</p>\n' +
  "    </div>\n" +
  "  )\n" +
  "}\n"

const FINAL = IMPORTS + PROGRAM + COMPONENT
// Classic mistake: use the Effect without executing it — `program` is a
// *description*, not the value, so nothing runs (and React can't render it).
const BUGGY = FINAL.replace('const result = Effect.runSync(program)', 'const result = program')

const INDEX_HTML = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>preview</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
`
const MAIN_TSX = `import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
createRoot(document.getElementById('root')).render(<App />)
`

export const lesson = {
  slug: 'effect-basics',
  title: 'A first Effect program',
  subtitle: 'Describe a computation, then run it',
  library: 'effect',
  throughline: 'effect',
  persona: 'devreel',
  accent: '#6a3f9e',
  format: 'video',
  workspace: {
    files: { '/index.html': INDEX_HTML, '/src/main.tsx': MAIN_TSX, '/src/App.tsx': FINAL },
    previewPort: 3000,
    previewMode: 'react',
  },
  scenes: [
    {
      id: 's1', chapter: 'Intro', focus: 'editor',
      narration: "Let's write a first **Effect** program — a typed, composable, *lazy* description of a computation.",
      say: "Let's write a first Effect program. A typed, composable, lazy description of a computation.",
      cue: "first Effect program",
    },
    {
      id: 's2', chapter: 'Imports', focus: 'editor',
      narration: 'Import `Effect` and `pipe` from the `effect` package.',
      say: 'Import Effect and pipe from the effect package.',
      cue: 'Import Effect',
      action: { tool: 'editor', file: '/src/App.tsx', type: IMPORTS },
    },
    {
      id: 's3', chapter: 'Describe', focus: 'editor',
      narration: '`Effect.succeed(21)` *describes* a success; `Effect.map` transforms its value. Nothing has run yet.',
      say: 'Effect.succeed twenty-one describes a success. Effect.map transforms its value. Nothing has run yet.',
      cue: 'describes a success',
      action: {
        tool: 'editor', file: '/src/App.tsx', type: PROGRAM,
        callouts: [{ line: 4, text: 'a description — nothing runs yet', kind: 'tip' }],
      },
    },
    {
      id: 's4', chapter: 'Use it', focus: 'editor',
      narration: 'Render the program in a component.',
      say: 'Render the program in a component.',
      cue: 'in a component',
      action: { tool: 'editor', file: '/src/App.tsx', type: COMPONENT },
    },
    {
      id: 's5', chapter: 'A common bug', focus: 'editor',
      narration: "A classic mistake: using `program` directly. It's only a **description** — it never runs.",
      say: "A classic mistake: using program directly. It's only a description. It never runs.",
      cue: 'classic mistake',
      action: {
        tool: 'editor', file: '/src/App.tsx', replace: BUGGY, typed: false,
        diagnostics: [{ line: 10, message: 'An Effect is a lazy description, not a value. Execute it with Effect.runSync(program).', severity: 'error' }],
        callouts: [{ line: 10, text: '🐛 never executed', kind: 'warn' }],
      },
    },
    {
      id: 's6', chapter: 'Run it', focus: 'editor',
      narration: '`Effect.runSync` **executes** the description and returns the value.',
      say: 'Effect.runSync executes the description and returns the value.',
      cue: 'executes the description',
      action: {
        tool: 'editor', file: '/src/App.tsx', replace: FINAL, typed: false, reveal: [9, 11],
        callouts: [{ line: 10, text: '✅ runSync executes it', kind: 'tip' }],
      },
    },
    {
      id: 's7', chapter: 'Live', focus: 'preview',
      narration: 'Here it is running live — `runSync` returns **42**.',
      say: 'Here it is running live. runSync returns forty-two.',
      cue: 'running live',
      action: { tool: 'preview', steps: [{ cmd: 'waitFor', selector: 'h1' }] },
    },
  ],
}
