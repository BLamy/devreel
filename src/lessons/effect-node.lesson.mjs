// Effect as a Node script in the terminal, explained line by line. The editor and
// terminal show together; the terminal frame is short (one command at the end).
// Bake: node generator/cli.mjs --lesson src/lessons/effect-node.lesson.mjs

const seg = {
  imports: 'import { Effect, pipe } from "effect"\n\n',
  progOpen: 'const program = pipe(\n',
  succeed: '  Effect.succeed(21),\n',
  map: '  Effect.map((n) => n * 2),\n',
  progClose: ')\n\n',
  run: 'const result = Effect.runSync(program)\n',
  log: 'console.log("result =", result)\n',
}
const ORDER = ['imports', 'progOpen', 'succeed', 'map', 'progClose', 'run', 'log']
const FINAL = ORDER.map((k) => seg[k]).join('')
const lineOf = (needle) => FINAL.split('\n').findIndex((l) => l.includes(needle)) + 1
const BUGGY = FINAL.replace('const result = Effect.runSync(program)', 'const result = program')

const PKG_JSON = '{\n  "name": "effect-demo",\n  "type": "module"\n}\n'
const F = '/program.ts'
const ed = (key, extra = {}) => ({ tool: 'editor', file: F, type: seg[key], ...extra })

export const lesson = {
  slug: 'effect-node',
  title: 'Run Effect in Node',
  subtitle: 'A script in the console — explained line by line',
  library: 'effect',
  throughline: 'effect',
  persona: 'devreel',
  accent: '#6a3f9e',
  format: 'video',
  series: 'Effect: a first program',
  seriesOrder: 2,
  // One command at the end, so keep the terminal frame small.
  stage: { editor: 0.64, mobileEditor: 0.72 },
  workspace: {
    files: { '/program.ts': FINAL, '/package.json': PKG_JSON },
  },
  scenes: [
    {
      id: 's1', chapter: 'Intro', focus: 'editor',
      narration: "Let's write a basic **Effect** program and run it as a Node script — no browser.",
      say: "Let's write a basic Effect program and run it as a Node script in the console. No browser this time. And I'll explain every line.",
      cue: 'basic Effect program',
    },
    {
      id: 's2', chapter: 'Imports', focus: 'editor',
      narration: 'Import `Effect` and `pipe` from the `effect` package.',
      say: 'We import Effect and pipe from the effect package, which we will install from npm in a moment.',
      cue: 'import Effect and pipe',
      action: ed('imports'),
    },
    {
      id: 's3', chapter: 'pipe', focus: 'editor',
      narration: '`pipe` feeds a value left-to-right through functions.',
      say: 'pipe feeds a value left to right through a series of functions. We open it here.',
      cue: 'feeds a value left to right',
      action: ed('progOpen'),
    },
    {
      id: 's4', chapter: 'succeed', focus: 'editor',
      narration: '`Effect.succeed(21)` describes a success with 21.',
      say: 'Effect.succeed of twenty-one describes a computation that succeeds with twenty-one. It only describes — nothing runs yet.',
      cue: 'describes a computation',
      action: ed('succeed'),
    },
    {
      id: 's5', chapter: 'map', focus: 'editor',
      narration: '`Effect.map` doubles the value.',
      say: 'Effect.map transforms the success value. Here we double it, turning twenty-one into forty-two.',
      cue: 'transforms the success value',
      action: ed('map'),
    },
    {
      id: 's6', chapter: 'A description', focus: 'editor',
      narration: '`program` is just a **description** — nothing has run.',
      say: 'We close the pipe. program is just a description of what to do; nothing has executed.',
      cue: 'close the pipe',
      action: ed('progClose', { callouts: [{ line: lineOf('const program'), text: 'a description — nothing runs yet', kind: 'tip' }] }),
    },
    {
      id: 's7', chapter: 'Run it', focus: 'editor',
      narration: '`Effect.runSync` executes it and returns the value.',
      say: 'Effect.runSync executes the description, synchronously, and gives us back the value.',
      cue: 'executes the description',
      action: ed('run', { callouts: [{ line: lineOf('Effect.runSync'), text: 'runSync executes it', kind: 'tip' }] }),
    },
    {
      id: 's8', chapter: 'Log', focus: 'editor',
      narration: 'Print the result with `console.log`.',
      say: 'And we print the result to the console with console dot log.',
      cue: 'print the result',
      action: ed('log'),
    },
    {
      id: 's9', chapter: 'A common bug', focus: 'editor',
      narration: 'Forget `runSync` and you log the **description**, not 42.',
      say: "A quick gotcha: if you forget runSync and log program directly, you print the Effect description object, not forty-two. Effect is lazy, so you must run it.",
      cue: 'quick gotcha',
      action: {
        tool: 'editor', file: F, replace: BUGGY, typed: false,
        reveal: [lineOf('const result') - 1, lineOf('const result') + 1],
        diagnostics: [{ line: lineOf('const result'), message: 'An Effect is a lazy description, not a value. Execute it with Effect.runSync(program).', severity: 'error' }],
        callouts: [{ line: lineOf('const result'), text: '🐛 never executed', kind: 'warn' }],
      },
    },
    {
      id: 's10', chapter: 'The fix', focus: 'editor',
      narration: 'Run it with `Effect.runSync`.',
      say: 'So we keep Effect.runSync, and result holds the real number.',
      cue: 'keep Effect',
      action: {
        tool: 'editor', file: F, replace: FINAL, typed: false,
        reveal: [lineOf('Effect.runSync') - 1, lineOf('Effect.runSync') + 1],
        callouts: [{ line: lineOf('Effect.runSync'), text: '✅ runSync executes it', kind: 'tip' }],
      },
    },
    {
      id: 's11', chapter: 'Console', focus: 'terminal',
      narration: 'Install Effect, then run it with Node — the console prints **result = 42**.',
      say: 'Now to the console. We install effect from npm, then run the script with node. It prints result equals forty-two.',
      cue: 'install effect from npm',
      autoAdvanceMs: 12000,
      action: { tool: 'terminal', run: 'npm install effect && node program.ts', expect: 'result = 42' },
    },
  ],
}
