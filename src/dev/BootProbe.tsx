import { useEffect, useRef, useState } from 'react'
import { startReactPreview, type PreviewHandle } from '../almost/preview'
import { sampleReactApp } from './sampleApp'

type Status = 'idle' | 'booting' | 'ready' | 'error'

// M1 de-risk probe: prove that a brand-new repo can boot an almostnode
// workspace and render a live React preview (with Eruda) in an iframe.
export function BootProbe() {
  const [status, setStatus] = useState<Status>('idle')
  const [url, setUrl] = useState<string>('')
  const [log, setLog] = useState<string[]>([])
  const handleRef = useRef<PreviewHandle | null>(null)

  const append = (m: string) =>
    setLog((l) => [...l, `${new Date().toLocaleTimeString()}  ${m}`])

  useEffect(() => {
    let cancelled = false
    setStatus('booting')
    append('creating workspace + starting dev server…')
    startReactPreview(sampleReactApp)
      .then((h) => {
        if (cancelled) {
          h.stop()
          return
        }
        handleRef.current = h
        setUrl(h.url)
        setStatus('ready')
        append(`preview ready at ${h.url}`)
      })
      .catch((err) => {
        console.error(err)
        setStatus('error')
        append(`ERROR: ${err?.message ?? String(err)}`)
      })
    return () => {
      cancelled = true
      handleRef.current?.stop()
    }
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100vh', font: '14px system-ui' }}>
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', minWidth: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 12, alignItems: 'center' }}>
          <strong>devreel boot probe</strong>
          <span style={{ padding: '2px 8px', borderRadius: 999, background: status === 'ready' ? '#dcfce7' : status === 'error' ? '#fee2e2' : '#e2e8f0' }}>{status}</span>
        </div>
        <pre style={{ flex: 1, margin: 0, padding: 16, overflow: 'auto', background: '#0f172a', color: '#e2e8f0', fontSize: 12 }}>
          {log.join('\n')}
        </pre>
      </div>
      <div style={{ minWidth: 0 }}>
        {url ? (
          <iframe src={url} title="preview" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
        ) : (
          <div style={{ padding: 24, color: '#64748b' }}>Booting preview…</div>
        )}
      </div>
    </div>
  )
}
