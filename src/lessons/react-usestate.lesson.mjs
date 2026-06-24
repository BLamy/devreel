// Focused lesson: React useState only (a counter). Part 1 of the React Hooks
// series. Bake: node generator/cli.mjs --lesson src/lessons/react-usestate.lesson.mjs

const seg = {
  imports: "import React, { useState } from 'react'\n\n",
  fnOpen: 'export default function App() {\n',
  count: '  const [count, setCount] = useState(0)\n\n',
  returnOpen: '  return (\n',
  divOpen: '    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">\n',
  h1: '      <h1 className="text-2xl font-bold">Counter</h1>\n',
  button:
    '      <button\n' +
    '        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"\n' +
    '        onClick={() => setCount(count + 1)}\n' +
    '      >\n' +
    '        count is {count}\n' +
    '      </button>\n',
  close: '    </div>\n  )\n}\n',
}
const ORDER = ['imports', 'fnOpen', 'count', 'returnOpen', 'divOpen', 'h1', 'button', 'close']
const FINAL = ORDER.map((k) => seg[k]).join('')
const lineOf = (needle) => FINAL.split('\n').findIndex((l) => l.includes(needle)) + 1
const BUGGY = FINAL.replace('onClick={() => setCount(count + 1)}', 'onClick={setCount(count + 1)}')

const INDEX_HTML = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>preview</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>
`
const MAIN_JSX = `import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
createRoot(document.getElementById('root')).render(<App />)
`
const F = '/src/App.jsx'
const ed = (key, extra = {}) => ({ tool: 'editor', file: F, type: seg[key], ...extra })

export const lesson = {
  slug: 'react-usestate',
  title: 'useState',
  subtitle: 'Remember a value between renders',
  library: 'react',
  throughline: 'state',
  persona: 'devreel',
  accent: '#38bdf8',
  format: 'video',
  series: 'React Hooks',
  seriesOrder: 1,
  stage: { editor: 0.56, mobileEditor: 0.56 },
  workspace: {
    files: { '/index.html': INDEX_HTML, '/src/main.jsx': MAIN_JSX, '/src/App.jsx': FINAL },
    previewPort: 3000,
    previewMode: 'react',
  },
  scenes: [
    {
      id: 's1', chapter: 'Intro', focus: 'editor',
      narration: 'The **useState** hook lets a component remember a value between renders. We\'ll build a counter.',
      say: "The useState hook lets a component remember a value between renders. Let's build a counter, and explain every line.",
      cue: 'useState hook lets a component',
    },
    {
      id: 's2', chapter: 'Import', focus: 'editor',
      narration: 'Import `useState` from React.',
      say: 'First we import useState from React. It is a named export, so it goes in curly braces.',
      cue: 'import useState from React',
      action: ed('imports'),
    },
    {
      id: 's3', chapter: 'Component', focus: 'editor',
      narration: '`App` is a function component that returns JSX.',
      say: 'Our component is a function called App. Whatever it returns is what React draws.',
      cue: 'function called App',
      action: ed('fnOpen'),
    },
    {
      id: 's4', chapter: 'State', focus: 'editor',
      narration: '`useState(0)` returns `[value, setter]` — here, `count` and `setCount`, starting at 0.',
      say: 'useState of zero is the key line. It returns a pair: the current value, count, and a function to update it, setCount. We name both with array destructuring, and the starting value is zero. Every time setCount runs, React re-renders with the new value.',
      cue: 'the key line',
      action: ed('count', { callouts: [{ line: lineOf('useState(0)'), text: 'value + setter', kind: 'tip' }] }),
    },
    {
      id: 's5', chapter: 'JSX', focus: 'editor',
      narration: 'Now the markup we return.',
      say: 'Now the markup the component returns.',
      cue: 'the markup the component',
      action: ed('returnOpen'),
    },
    {
      id: 's6', chapter: 'Layout', focus: 'editor',
      narration: 'A wrapper `div` styled with **Tailwind**.',
      say: "A wrapping div styled with Tailwind. min height screen makes it at least the viewport height. b g slate fifty is a light grey background. p eight is padding on all sides. And text slate nine hundred is dark text.",
      cue: 'styled with Tailwind',
      action: ed('divOpen'),
    },
    {
      id: 's7', chapter: 'Heading', focus: 'editor',
      narration: 'A bold heading.',
      say: 'A heading. text two x l for size, font bold for weight.',
      cue: 'A heading',
      action: ed('h1'),
    },
    {
      id: 's8', chapter: 'Button', focus: 'editor',
      narration: 'The button reads `count` and updates it with `setCount`.',
      say: "The button. m t four adds top margin. rounded l g gives rounded corners. b g indigo six hundred is the background color, with text white for the label. p x four and p y two are horizontal and vertical padding. hover b g indigo five hundred lightens it on hover. And the onClick calls setCount with count plus one, wrapped in an arrow function so it only runs on click.",
      cue: 'The button',
      action: ed('button', { callouts: [{ line: lineOf('onClick'), text: 'arrow = runs on click', kind: 'tip' }] }),
    },
    {
      id: 's9', chapter: 'A common bug', focus: 'editor',
      narration: 'Drop the arrow function and `setCount` runs on **every render** — an infinite loop.',
      say: "Here's the classic mistake. If you drop the arrow function and call setCount directly, React runs it during every render. That triggers another render, which calls it again — an infinite loop. React throws too many re-renders.",
      cue: 'the classic mistake',
      action: {
        tool: 'editor', file: F, replace: BUGGY, typed: false,
        reveal: [lineOf('onClick') - 1, lineOf('onClick') + 1],
        diagnostics: [{ line: lineOf('onClick'), message: "Calling setCount during render causes 'Too many re-renders'. Wrap it in an arrow function.", severity: 'error' }],
        callouts: [{ line: lineOf('onClick'), text: '🐛 runs on every render', kind: 'warn' }],
      },
    },
    {
      id: 's10', chapter: 'The fix', focus: 'editor',
      narration: 'Wrap it in an arrow function — it only fires **on click**.',
      say: 'The fix is the arrow function. Now setCount only runs when the user actually clicks.',
      cue: 'the arrow function',
      action: {
        tool: 'editor', file: F, replace: FINAL, typed: false,
        reveal: [lineOf('onClick') - 1, lineOf('onClick') + 1],
        callouts: [{ line: lineOf('onClick'), text: '✅ arrow = on click', kind: 'tip' }],
      },
    },
    {
      id: 's11', chapter: 'Live', focus: 'preview',
      narration: 'Here it is running live, beside the code.',
      say: 'And here it is running live, right beside the code.',
      cue: 'running live',
      action: { tool: 'preview', steps: [{ cmd: 'waitFor', selector: 'button' }] },
    },
    {
      id: 's12', chapter: 'Try it', focus: 'preview',
      narration: 'Each click calls `setCount`; React re-renders with the new count.',
      say: 'Watch the counter. Each click calls setCount, React re-renders, and the number goes up. That is useState.',
      cue: 'Watch the counter',
      action: { tool: 'preview', steps: [{ cmd: 'click', selector: 'button' }, { cmd: 'click', selector: 'button' }, { cmd: 'click', selector: 'button' }] },
    },
  ],
}
