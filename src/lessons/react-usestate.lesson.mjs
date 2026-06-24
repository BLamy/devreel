// Authored lesson (the format the /new-lesson agent produces): a plain JS module
// exporting `lesson`. Run through the pipeline with:
//   node generator/cli.mjs --lesson src/lessons/react-usestate.lesson.mjs

const IMPORTS = `import React, { useEffect, useState } from 'react'\n\n`
const FINAL = `${IMPORTS}export default function App() {
  const [count, setCount] = useState(0)
  const [tip, setTip] = useState('')

  useEffect(() => {
    fetch('https://jsonplaceholder.typicode.com/todos/1')
      .then((r) => r.json())
      .then((d) => setTip(d.title))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <h1 className="text-2xl font-bold">useState counter</h1>
      <button
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
        onClick={() => setCount(count + 1)}
      >
        count is {count}
      </button>
      <p className="mt-4 text-slate-600">{tip || 'loading…'}</p>
    </div>
  )
}
`
const BODY = FINAL.slice(IMPORTS.length)
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

export const lesson = {
  slug: 'react-usestate',
  title: 'React state with useState',
  subtitle: 'Build a counter that also fetches data',
  library: 'react',
  throughline: 'state',
  persona: 'devreel',
  accent: '#38bdf8',
  workspace: {
    files: { '/index.html': INDEX_HTML, '/src/main.jsx': MAIN_JSX, '/src/App.jsx': FINAL },
    previewPort: 3000,
    previewMode: 'react',
  },
  scenes: [
    {
      id: 's1', chapter: 'Intro', focus: 'editor',
      narration: "Let's learn **React state** with `useState` — a counter that also fetches a tip.",
      say: "Let's learn React state with useState, by building a counter that also fetches a tip.",
      cue: "Let's learn React state",
    },
    {
      id: 's2', chapter: 'Imports', focus: 'editor',
      narration: 'First, import `useState` and `useEffect` from React.',
      say: 'First, import useState and useEffect from React.',
      cue: 'First, import',
      action: { tool: 'editor', file: '/src/App.jsx', type: IMPORTS },
    },
    {
      id: 's3', chapter: 'The component', focus: 'editor',
      narration: '`useState(0)` returns the current value and a setter. We fetch a tip on mount with `useEffect`.',
      say: 'useState returns the current value and a setter. We also fetch a tip on mount with useEffect.',
      cue: 'useState returns',
      action: { tool: 'editor', file: '/src/App.jsx', type: BODY, callouts: [{ line: 4, text: 'value + setter', kind: 'tip' }] },
    },
    {
      id: 's4', chapter: 'A common bug', focus: 'editor',
      narration: 'A classic mistake: calling `setCount` directly runs it on **every render** — an infinite loop.',
      say: 'A classic mistake: calling setCount directly runs it on every render, causing an infinite loop.',
      cue: 'A classic mistake',
      action: {
        tool: 'editor', file: '/src/App.jsx', replace: BUGGY, typed: false,
        diagnostics: [{ line: 18, message: "Calling setCount during render causes 'Too many re-renders'. Wrap it in an arrow function.", severity: 'error' }],
        callouts: [{ line: 18, text: '🐛 runs on every render', kind: 'warn' }],
      },
    },
    {
      id: 's5', chapter: 'The fix', focus: 'editor',
      narration: 'Wrap it in an arrow function so it only fires **on click**.',
      say: 'Wrap it in an arrow function so it only fires on click.',
      cue: 'Wrap it in an arrow',
      action: { tool: 'editor', file: '/src/App.jsx', replace: FINAL, typed: false, reveal: [16, 19], callouts: [{ line: 18, text: '✅ arrow = on click', kind: 'tip' }] },
    },
    {
      id: 's6', chapter: 'Live', focus: 'preview',
      narration: 'Here it is running live — a real React app, not a screenshot.',
      say: 'Here it is running live. A real React app, not a screenshot.',
      cue: 'Here it is running live',
      action: { tool: 'preview', steps: [{ cmd: 'waitFor', selector: 'button' }] },
    },
    {
      id: 's7', chapter: 'Try it', focus: 'preview',
      narration: 'Watch — clicking the button runs `setCount`, and React re-renders the new count.',
      say: 'Watch. Clicking the button runs setCount, and React re-renders the new count.',
      cue: 'clicking the button',
      action: { tool: 'preview', steps: [{ cmd: 'click', selector: 'button' }, { cmd: 'click', selector: 'button' }, { cmd: 'click', selector: 'button' }] },
    },
    {
      id: 's8', chapter: 'Devtools', focus: 'preview',
      narration: 'Now open the **network** tab — the `fetch` to `/todos/1` returns the tip we render.',
      say: 'Now open the network tab. The fetch to todos one returns the tip we render.',
      cue: 'open the network',
      action: { tool: 'preview', steps: [{ cmd: 'network', match: 'todos' }] },
    },
  ],
}
