import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { ensureServiceWorker } from './almost/preview'

// Recursion guard: the almostnode preview proxy serves iframes from
// /__virtual__/<port>/. If the SW ever fails to intercept, the SPA fallback
// would load devreel inside its own preview iframe. Never mount there.
if (window.location.pathname.startsWith('/__virtual__')) {
  // no-op: this document is a preview frame, not the devreel app
} else {
  const root = createRoot(document.getElementById('root')!)
  root.render(<div style={{ font: '14px system-ui', padding: 24, color: '#64748b' }}>Initializing workspace runtime…</div>)
  // Gate the real app on the service worker controlling the page, so previews
  // are intercepted from the very first iframe load. (First load reloads once.)
  ensureServiceWorker().finally(() => {
    root.render(<App />)
  })
}
