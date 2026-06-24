import { useEffect, useRef, useState } from 'react'
import { startReactPreview, prepareSeed, type PreviewHandle, type SeedFiles } from '../almost/preview'
import { PreviewDriver, delay, type RectLike } from '../preview/driver'
import type { PreviewAction, PreviewStep } from '../lesson/types'

export interface PreviewPaneProps {
  files: SeedFiles
  port?: number
  action?: PreviewAction | null
  actionNonce?: number
  /** The editor's current file content; written into the live VFS → HMR. */
  liveFiles?: Record<string, string>
}

type Status = 'booting' | 'ready' | 'error'
type Cursor = { x: number; y: number; ripple: boolean }

// Compile legacy convenience fields into an explicit step list.
function compileSteps(a: PreviewAction): PreviewStep[] {
  if (a.steps?.length) return a.steps
  const out: PreviewStep[] = []
  if (a.navigate) out.push({ cmd: 'goto', url: a.navigate })
  if (a.click) out.push({ cmd: 'click', selector: a.click })
  if (a.focusNetwork) out.push({ cmd: 'network', match: a.focusNetwork })
  else if (a.openEruda) out.push({ cmd: 'devtools', tab: a.openEruda })
  return out
}

// Boots a live almostnode preview once and keeps it mounted, then drives each
// scene's steps deterministically with an animated cursor + real Eruda/network.
export function PreviewPane({ files, port = 3000, action, actionNonce, liveFiles }: PreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const handleRef = useRef<PreviewHandle | null>(null)
  const driverRef = useRef<PreviewDriver | null>(null)
  const baseUrlRef = useRef<string>('')
  const lastWrittenRef = useRef<Record<string, string>>({})
  const [status, setStatus] = useState<Status>('booting')
  const [error, setError] = useState('')
  const [cursor, setCursor] = useState<Cursor | null>(null)

  useEffect(() => {
    let cancelled = false
    startReactPreview(prepareSeed(files), { port })
      .then((h) => {
        if (cancelled) return h.stop()
        handleRef.current = h
        baseUrlRef.current = h.url
        driverRef.current = new PreviewDriver(() => iframeRef.current?.contentWindow ?? null)
        setStatus('ready')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.message ?? String(e))
        setStatus('error')
      })
    return () => {
      cancelled = true
      driverRef.current?.dispose()
      driverRef.current = null
      handleRef.current?.stop()
      handleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hot-reload: write the editor's current code into the live VFS so the dev
  // server re-renders the iframe (HMR). Only complete files are passed in.
  useEffect(() => {
    const h = handleRef.current
    if (!h || status !== 'ready' || !liveFiles) return
    for (const [path, content] of Object.entries(liveFiles)) {
      if (lastWrittenRef.current[path] === content) continue
      try {
        const dir = path.split('/').slice(0, -1).join('/')
        if (dir && dir !== '/') h.container.vfs.mkdirSync(dir, { recursive: true })
        h.container.vfs.writeFileSync(path, content)
        lastWrittenRef.current[path] = content
      } catch {
        /* noop */
      }
    }
  }, [liveFiles, status])

  // Run the current scene's steps.
  useEffect(() => {
    const driver = driverRef.current
    if (status !== 'ready' || !driver || !action) return
    let cancelled = false
    const steps = compileSteps(action)

    const moveCursorTo = (rect: RectLike) => setCursor({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, ripple: false })
    const ripple = () => {
      setCursor((c) => (c ? { ...c, ripple: true } : c))
      setTimeout(() => setCursor((c) => (c ? { ...c, ripple: false } : c)), 600)
    }
    const navigate = (path: string) => {
      const iframe = iframeRef.current
      if (!iframe) return Promise.resolve()
      const base = baseUrlRef.current.replace(/\/$/, '')
      return new Promise<void>((resolve) => {
        const onLoad = () => { iframe.removeEventListener('load', onLoad); resolve() }
        iframe.addEventListener('load', onLoad)
        iframe.src = base + (path.startsWith('/') ? path : '/' + path)
        setTimeout(resolve, 4000)
      })
    }

    ;(async () => {
      for (const s of steps) {
        if (cancelled) return
        if (s.cmd === 'goto') { await navigate(s.url || '/'); continue }
        if (s.cmd === 'devtools') { driver.showDevtools(s.tab); await delay(500); continue }
        if (s.cmd === 'network') {
          // Open the network tab, move the cursor to the request row, click it so
          // Eruda opens the request detail, then scroll to the response.
          driver.showDevtools('network')
          await delay(800)
          driver.focusNetwork(s.match || '')
          const loc = await driver.locateNetRow(s.match || '')
          if (loc.ok && loc.rect) { moveCursorTo(loc.rect); await delay(500) }
          if (cancelled) return
          const clicked = await driver.clickNetRow(s.match || '')
          if (clicked.ok) ripple()
          await delay(700)
          const resp = await driver.showResponse()
          if (resp.ok && resp.rect) moveCursorTo(resp.rect)
          await delay(400)
          continue
        }
        if (s.cmd === 'waitFor') { await driver.waitFor(s.selector || ''); continue }
        if (s.cmd === 'type') { await driver.type(s.text || ''); await delay(300); continue }
        if (s.cmd === 'press') { await driver.press(s.key || 'Enter'); await delay(300); continue }
        // selector-based: animate the cursor to the element, then act
        const loc = await driver.locate(s.selector || '')
        if (loc.ok && loc.rect) { moveCursorTo(loc.rect); await delay(480) }
        if (cancelled) return
        if (s.cmd === 'click') { await driver.click(s.selector || ''); ripple() }
        else if (s.cmd === 'fill') { await driver.fill(s.selector || '', s.text || '') }
        else if (s.cmd === 'hover') { await driver.hover(s.selector || '') }
        await delay(350)
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, actionNonce, status])

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', background: '#fff', overflow: 'hidden' }}>
      {status !== 'ready' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#64748b', font: '13px system-ui', background: '#0f172a', zIndex: 2 }}>
          {status === 'error' ? `preview error: ${error}` : 'booting live preview…'}
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="preview"
        src={status === 'ready' ? baseUrlRef.current : undefined}
        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
      />
      {cursor && (
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${cursor.x}px, ${cursor.y}px)`, transition: 'transform 0.46s cubic-bezier(0.22,1,0.36,1)', pointerEvents: 'none', zIndex: 6 }}>
          {cursor.ripple && (
            <span style={{ position: 'absolute', left: -18, top: -18, width: 36, height: 36, borderRadius: '50%', background: 'rgba(56,189,248,0.5)', animation: 'devreel-ripple 0.6s ease-out forwards' }} />
          )}
          <svg width="22" height="22" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
            <path d="M3 2 L3 18 L7 14 L10 21 L13 19 L10 12 L16 12 Z" fill="#fff" stroke="#0f172a" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <style>{'@keyframes devreel-ripple{from{transform:scale(0.3);opacity:0.8}to{transform:scale(2.4);opacity:0}}'}</style>
    </div>
  )
}
