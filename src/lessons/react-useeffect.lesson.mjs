// Focused lesson: React useEffect (run a side effect after render; fetch data).
// Part 2 of the React Hooks series.
// Bake: node generator/cli.mjs --lesson src/lessons/react-useeffect.lesson.mjs

const seg = {
  imports: "import React, { useEffect, useState } from 'react'\n\n",
  fnOpen: 'export default function App() {\n',
  state: "  const [tip, setTip] = useState('')\n\n",
  effectOpen: '  useEffect(() => {\n',
  fetchCall: "    fetch('https://jsonplaceholder.typicode.com/todos/1')\n",
  thenJson: '      .then((r) => r.json())\n',
  thenSet: '      .then((d) => setTip(d.title))\n',
  effectClose: '  }, [])\n\n',
  returnOpen: '  return (\n',
  divOpen: '    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">\n',
  h1: '      <h1 className="text-2xl font-bold">Tip of the day</h1>\n',
  para: "      <p className=\"mt-4 text-slate-600\">{tip || 'loading…'}</p>\n",
  close: '    </div>\n  )\n}\n',
}
const ORDER = ['imports', 'fnOpen', 'state', 'effectOpen', 'fetchCall', 'thenJson', 'thenSet', 'effectClose', 'returnOpen', 'divOpen', 'h1', 'para', 'close']
const FINAL = ORDER.map((k) => seg[k]).join('')
const lineOf = (needle) => FINAL.split('\n').findIndex((l) => l.includes(needle)) + 1
// Common bug: omit the dependency array → the effect runs after EVERY render.
const BUGGY = FINAL.replace('  }, [])\n', '  })\n')

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
  slug: 'react-useeffect',
  title: 'useEffect',
  subtitle: 'Run a side effect after render — fetch data',
  library: 'react',
  throughline: 'effects',
  persona: 'devreel',
  accent: '#38bdf8',
  format: 'video',
  series: 'React Hooks',
  seriesOrder: 2,
  stage: { editor: 0.56, mobileEditor: 0.56 },
  workspace: {
    files: { '/index.html': INDEX_HTML, '/src/main.jsx': MAIN_JSX, '/src/App.jsx': FINAL },
    previewPort: 3000,
    previewMode: 'react',
  },
  scenes: [
    {
      id: 's1', chapter: 'Intro', focus: 'editor',
      narration: '**useEffect** runs a side effect after render. We\'ll fetch a tip on mount.',
      say: 'useEffect lets you run a side effect after the component renders. We will use it to fetch a tip when the component mounts, and explain every line.',
      cue: 'run a side effect',
    },
    {
      id: 's2', chapter: 'Import', focus: 'editor',
      narration: 'Import `useEffect` and `useState`.',
      say: 'We import useEffect and useState from React. We need state to hold the fetched value.',
      cue: 'import useEffect and useState',
      action: ed('imports'),
    },
    {
      id: 's3', chapter: 'Component', focus: 'editor',
      narration: 'The component.',
      say: 'Our component function, App.',
      cue: 'component function',
      action: ed('fnOpen'),
    },
    {
      id: 's4', chapter: 'State', focus: 'editor',
      narration: '`tip` holds the fetched text, starting empty.',
      say: 'A piece of state called tip, starting as an empty string. The fetch will fill it.',
      cue: 'piece of state called tip',
      action: ed('state'),
    },
    {
      id: 's5', chapter: 'Effect', focus: 'editor',
      narration: '`useEffect` takes a function React runs **after** render.',
      say: 'useEffect takes a function that React runs after the render is painted. This is the right place for side effects like data fetching — never directly in the component body, which runs during render.',
      cue: 'after the render',
      action: ed('effectOpen'),
    },
    {
      id: 's6', chapter: 'Fetch', focus: 'editor',
      narration: '`fetch` returns a promise of the response.',
      say: 'Inside, we call fetch with a URL. fetch returns a promise that resolves to the response.',
      cue: 'call fetch with a URL',
      action: ed('fetchCall'),
    },
    {
      id: 's7', chapter: 'Parse', focus: 'editor',
      narration: 'The first `.then` parses JSON.',
      say: 'The first dot then parses the response body as JSON, returning another promise with the data.',
      cue: 'parses the response body',
      action: ed('thenJson'),
    },
    {
      id: 's8', chapter: 'Store', focus: 'editor',
      narration: 'The second `.then` saves the title with `setTip`.',
      say: 'The second dot then takes that data and stores its title into state with setTip, which re-renders the component with the tip.',
      cue: 'stores its title into state',
      action: ed('thenSet'),
    },
    {
      id: 's9', chapter: 'Deps', focus: 'editor',
      narration: 'The empty dependency array `[]` means **run once**, on mount.',
      say: 'The most important part is the second argument: an empty dependency array. It tells React to run this effect only once, right after the first render, and never again.',
      cue: 'most important part',
      action: ed('effectClose', { callouts: [{ line: lineOf('}, [])'), text: '[] = run once on mount', kind: 'tip' }] }),
    },
    {
      id: 's10', chapter: 'JSX', focus: 'editor',
      narration: 'Markup: a heading and the tip.',
      say: 'Now the markup.',
      cue: 'Now the markup',
      action: ed('returnOpen'),
    },
    {
      id: 's11', chapter: 'Layout', focus: 'editor',
      narration: 'Tailwind wrapper + heading.',
      say: "A div styled with Tailwind: min height screen, a light b g slate fifty background, p eight padding, dark text slate nine hundred. And a bold heading with text two x l and font bold.",
      cue: 'styled with Tailwind',
      action: ed('divOpen'),
    },
    {
      id: 's12', chapter: 'Output', focus: 'editor',
      narration: 'Show the tip, or "loading" until it arrives.',
      say: 'The heading, then a paragraph. m t four for spacing, text slate six hundred for a muted grey. It shows the tip, or the word loading while the fetch is still in flight.',
      cue: 'a paragraph',
      action: ed('h1'),
    },
    {
      id: 's13', chapter: 'Output', focus: 'editor',
      narration: 'The paragraph binds `tip`.',
      say: 'And here is that paragraph, binding the tip value.',
      cue: 'binding the tip',
      action: ed('para'),
    },
    {
      id: 's14', chapter: 'A common bug', focus: 'editor',
      narration: 'Omit the dependency array and the effect runs after **every** render — a fetch loop.',
      say: "Here's the classic useEffect bug. If you omit the dependency array entirely, the effect runs after every render. The fetch calls setTip, which re-renders, which runs the effect again — an endless fetch loop.",
      cue: 'classic useEffect bug',
      action: {
        // The effect-close line keeps its line number when `}, [])` becomes `})`.
        tool: 'editor', file: F, replace: BUGGY, typed: false,
        reveal: [lineOf('}, [])') - 2, lineOf('}, [])')],
        diagnostics: [{ line: lineOf('}, [])'), message: 'Missing dependency array: this effect runs after every render and re-fetches forever. Add [].', severity: 'error' }],
        callouts: [{ line: lineOf('}, [])'), text: '🐛 runs every render', kind: 'warn' }],
      },
    },
    {
      id: 's15', chapter: 'The fix', focus: 'editor',
      narration: 'Add `[]` so it runs once.',
      say: 'The fix is to add the empty dependency array, so the effect runs exactly once.',
      cue: 'add the empty dependency',
      action: {
        tool: 'editor', file: F, replace: FINAL, typed: false,
        reveal: [lineOf('}, [])') - 1, lineOf('}, [])') + 1],
        callouts: [{ line: lineOf('}, [])'), text: '✅ runs once', kind: 'tip' }],
      },
    },
    {
      id: 's16', chapter: 'Live', focus: 'preview',
      narration: 'On mount, the effect fetches the tip and renders it.',
      say: 'Here it runs live. On mount, the effect fetches the tip, and it appears.',
      cue: 'runs live',
      action: { tool: 'preview', steps: [{ cmd: 'waitFor', selector: 'p' }] },
    },
    {
      id: 's17', chapter: 'Devtools', focus: 'preview',
      narration: 'In the **network** tab, the one `fetch` to `/todos/1` — it ran **once**.',
      say: 'And in the network tab, you can see exactly one request to todos one. Thanks to the empty dependency array, the effect ran a single time.',
      cue: 'in the network tab',
      action: { tool: 'preview', steps: [{ cmd: 'network', match: 'todos' }] },
    },
  ],
}
