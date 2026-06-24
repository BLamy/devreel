import type { SeedFiles } from '../almost/preview'

// A tiny React app seeded into the in-browser workspace, used to prove the
// preview pipeline end-to-end. It makes a network call on mount so we can later
// demonstrate "focus a network request" in Eruda.
export const sampleReactApp: SeedFiles = {
  '/index.html': `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>preview</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>
`,
  '/src/main.jsx': `import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
createRoot(document.getElementById('root')).render(<App />)
`,
  '/src/App.jsx': `import React, { useEffect, useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)
  const [todo, setTodo] = useState(null)

  useEffect(() => {
    fetch('https://jsonplaceholder.typicode.com/todos/1')
      .then((r) => r.json())
      .then(setTodo)
      .catch(() => {})
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, color: '#0f172a' }}>
      <h1>devreel preview ⚡</h1>
      <p>Live almostnode workspace rendering a real React app.</p>
      <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
      <pre style={{ background: '#f1f5f9', padding: 12, borderRadius: 8 }}>
        {todo ? JSON.stringify(todo, null, 2) : 'loading todo…'}
      </pre>
    </div>
  )
}
`,
}
