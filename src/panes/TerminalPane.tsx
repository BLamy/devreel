import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { createContainer } from 'almostnode'
import type { SeedFiles } from '../almost/preview'
import type { TerminalAction } from '../lesson/types'

export interface TerminalPaneProps {
  files: SeedFiles
  action?: TerminalAction | null
  actionNonce?: number
}

// xterm.js bound to a real almostnode terminal session (just-bash + 40 Node
// shims). The lesson's `run` commands execute for real; output streams in.
export function TerminalPane({ files, action, actionNonce }: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const containerRef = useRef<ReturnType<typeof createContainer> | null>(null)
  const [ready, setReady] = useState(false)
  const runningRef = useRef(false)

  useEffect(() => {
    if (!hostRef.current) return
    const term = new Terminal({
      theme: { background: '#0b1220', foreground: '#e2e8f0', cursor: '#38bdf8' },
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
      scrollback: 4000,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current)
    fit.fit()
    termRef.current = term

    const container = createContainer({ cwd: '/' })
    for (const [p, content] of Object.entries(files)) {
      const dir = p.split('/').slice(0, -1).join('/')
      if (dir && dir !== '/') container.vfs.mkdirSync(dir, { recursive: true })
      container.vfs.writeFileSync(p, content)
    }
    containerRef.current = container
    term.write('\x1b[90malmostnode terminal\x1b[0m\r\n$ ')
    setReady(true)

    const ro = new ResizeObserver(() => {
      try { fit.fit() } catch { /* noop */ }
    })
    ro.observe(hostRef.current)

    return () => {
      ro.disconnect()
      term.dispose()
      termRef.current = null
      containerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const term = termRef.current
    const container = containerRef.current
    if (!term || !container || !ready || !action?.run || runningRef.current) return
    const cmd = action.run
    runningRef.current = true
    term.write(`\x1b[36m${cmd}\x1b[0m\r\n`)
    let streamed = false
    container
      .run(cmd, {
        onStdout: (d: string) => { streamed = true; term.write(d) },
        onStderr: (d: string) => { streamed = true; term.write(`\x1b[31m${d}\x1b[0m`) },
      })
      .then((res: { stdout?: string; stderr?: string } | undefined) => {
        // Some almostnode commands return output in the result rather than
        // streaming it — surface it so the viewer sees what ran.
        if (!streamed && res) {
          if (res.stdout) term.write(res.stdout)
          if (res.stderr) term.write(`\x1b[31m${res.stderr}\x1b[0m`)
        }
      })
      .catch((e: unknown) => term.write(`\x1b[31m${String(e)}\x1b[0m`))
      .finally(() => {
        runningRef.current = false
        term.write('\r\n$ ')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, actionNonce, ready])

  return (
    <div style={{ height: '100%', width: '100%', background: '#0b1220', padding: 8 }}>
      <div ref={hostRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
