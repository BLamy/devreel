// A first Effect program run as a Node script in the terminal (no browser).
// Bake:  node generator/cli.mjs --lesson src/lessons/effect-node.lesson.mjs
//
// The editor types a real Effect program; the terminal installs `effect` from npm
// and runs it with Node, printing the result to the console.

const IMPORTS = 'import { Effect, pipe } from "effect"\n\n'
const PROGRAM =
  'const program = pipe(\n' +
  '  Effect.succeed(21),\n' +
  '  Effect.map((n) => n * 2),\n' +
  ')\n\n'
const RUN =
  'const result = Effect.runSync(program)\n' +
  'console.log("result =", result)\n'

const FINAL = IMPORTS + PROGRAM + RUN

const PKG_JSON = '{\n  "name": "effect-demo",\n  "type": "module"\n}\n'

export const lesson = {
  slug: 'effect-node',
  title: 'Run Effect in Node',
  subtitle: 'Write a script, run it in the console',
  library: 'effect',
  throughline: 'effect',
  persona: 'devreel',
  accent: '#6a3f9e',
  format: 'video',
  workspace: {
    files: { '/program.ts': FINAL, '/package.json': PKG_JSON },
  },
  scenes: [
    {
      id: 's1', chapter: 'Intro', focus: 'editor',
      narration: "Let's write a basic **Effect** program and run it as a Node script — no browser.",
      say: "Let's write a basic Effect program and run it as a Node script. No browser.",
      cue: 'basic Effect program',
    },
    {
      id: 's2', chapter: 'Imports', focus: 'editor',
      narration: 'Import `Effect` and `pipe` from the `effect` package.',
      say: 'Import Effect and pipe from the effect package.',
      cue: 'Import Effect',
      action: { tool: 'editor', file: '/program.ts', type: IMPORTS },
    },
    {
      id: 's3', chapter: 'Describe', focus: 'editor',
      narration: '`Effect.succeed(21)` *describes* a success; `Effect.map` transforms it. Nothing has run yet.',
      say: 'Effect.succeed twenty-one describes a success. Effect.map transforms it. Nothing has run yet.',
      cue: 'describes a success',
      action: {
        tool: 'editor', file: '/program.ts', type: PROGRAM,
        callouts: [{ line: 3, text: 'a description — nothing runs yet', kind: 'tip' }],
      },
    },
    {
      id: 's4', chapter: 'Run it', focus: 'editor',
      narration: '`Effect.runSync` **executes** the description and we `console.log` the result.',
      say: 'Effect.runSync executes the description, and we console-log the result.',
      cue: 'executes the description',
      action: {
        tool: 'editor', file: '/program.ts', type: RUN,
        callouts: [{ line: 8, text: '✅ runSync executes it', kind: 'tip' }],
      },
    },
    {
      id: 's5', chapter: 'Console', focus: 'terminal',
      narration: 'Install Effect, then run the script with Node — the console prints **result = 42**.',
      say: 'Install Effect from npm, then run the script with Node. The console prints result equals forty-two.',
      cue: 'run the script with Node',
      autoAdvanceMs: 12000,
      action: { tool: 'terminal', run: 'npm install effect && node program.ts', expect: 'result = 42' },
    },
  ],
}
