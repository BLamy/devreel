// Host side of the preview agent bridge: a Playwright-style RPC over postMessage
// to the preview iframe. Each command resolves with the target element's rect so
// the caller can animate a cursor before the action lands. Deterministic: the
// caller drives commands in a fixed order at scene cue times.

export interface RectLike {
  x: number
  y: number
  width: number
  height: number
}
export interface PwResult {
  ok: boolean
  rect?: RectLike
  error?: string
}

export class PreviewDriver {
  private seq = 0
  private pending = new Map<number, (r: PwResult) => void>()
  private onMessage = (e: MessageEvent) => {
    const m = e.data as { __devreel?: string; id?: number; ok?: boolean; rect?: RectLike; error?: string }
    if (m?.__devreel === 'pw-result' && typeof m.id === 'number') {
      const resolve = this.pending.get(m.id)
      if (resolve) {
        this.pending.delete(m.id)
        resolve({ ok: !!m.ok, rect: m.rect, error: m.error })
      }
    }
  }

  constructor(private getWin: () => Window | null | undefined) {
    window.addEventListener('message', this.onMessage)
  }

  dispose() {
    window.removeEventListener('message', this.onMessage)
    this.pending.clear()
  }

  private rpc(cmd: string, payload: Record<string, unknown> = {}): Promise<PwResult> {
    const win = this.getWin()
    if (!win) return Promise.resolve({ ok: false, error: 'no preview window' })
    const id = ++this.seq
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      win.postMessage({ __devreel: 'pw', id, cmd, ...payload }, '*')
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          resolve({ ok: false, error: 'rpc timeout' })
        }
      }, 6000)
    })
  }

  locate(selector: string) { return this.rpc('locate', { selector }) }
  click(selector: string) { return this.rpc('click', { selector }) }
  fill(selector: string, text: string) { return this.rpc('fill', { selector, text }) }
  type(text: string) { return this.rpc('type', { text }) }
  hover(selector: string) { return this.rpc('hover', { selector }) }
  press(key: string) { return this.rpc('press', { key }) }
  waitFor(selector: string) { return this.rpc('waitFor', { selector }) }

  /** Locate the matching (or only) network row in the open Eruda panel. */
  locateNetRow(match: string) { return this.rpc('netRow', { match }) }
  /** Click that network row so Eruda opens the request detail (response). */
  clickNetRow(match: string) { return this.rpc('netClick', { match }) }
  /** Best-effort scroll to the Response section of the open request detail. */
  showResponse() { return this.rpc('netResponse', {}) }

  private post(msg: unknown) {
    this.getWin()?.postMessage(msg, '*')
  }
  showDevtools(tab?: string) { this.post({ __devreel: 'eruda-open', tab }) }
  hideDevtools() { this.post({ __devreel: 'eruda-hide' }) }
  focusNetwork(url: string) { this.post({ __devreel: 'eruda-focus-network', url }) }
}

export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
