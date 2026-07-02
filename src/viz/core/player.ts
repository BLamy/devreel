/**
 * rAF clock with play/pause/scrub/loop. Subscribers are called once per frame
 * with the current time in ms; nothing here touches React, so playback never
 * re-renders the component tree.
 */
export interface Player {
  play(): void
  pause(): void
  toggle(): void
  seek(ms: number): void
  time(): number
  playing(): boolean
  /** per-frame subscriber; returns unsubscribe */
  onFrame(fn: (time: number) => void): () => void
  onState(fn: (playing: boolean) => void): void
  dispose(): void
}

export function createPlayer(
  total: number,
  opts: { loop?: boolean; autoplay?: boolean } = {},
): Player {
  const loop = opts.loop ?? true
  let time = 0
  let playing = false
  let raf = 0
  let last = 0
  let disposed = false
  const frameSubs = new Set<(t: number) => void>()
  let stateSub: ((p: boolean) => void) | null = null

  const emit = () => {
    for (const fn of frameSubs) fn(time)
  }

  const tick = (now: number) => {
    if (!playing || disposed) return
    const dt = Math.min(now - last, 100) // clamp tab-switch jumps
    last = now
    time += dt
    if (time >= total) {
      if (loop) time = time % Math.max(total, 1)
      else {
        time = total
        playing = false
        stateSub?.(false)
      }
    }
    emit()
    if (playing) raf = requestAnimationFrame(tick)
  }

  const play = () => {
    if (playing || disposed) return
    playing = true
    if (time >= total) time = 0
    last = performance.now()
    stateSub?.(true)
    raf = requestAnimationFrame(tick)
  }

  const pause = () => {
    if (!playing) return
    playing = false
    cancelAnimationFrame(raf)
    stateSub?.(false)
  }

  const player: Player = {
    play,
    pause,
    toggle: () => (playing ? pause() : play()),
    seek: (ms: number) => {
      time = Math.max(0, Math.min(ms, total))
      last = performance.now()
      emit()
    },
    time: () => time,
    playing: () => playing,
    onFrame: (fn) => {
      frameSubs.add(fn)
      return () => frameSubs.delete(fn)
    },
    onState: (fn) => {
      stateSub = fn
    },
    dispose: () => {
      disposed = true
      pause()
      frameSubs.clear()
      stateSub = null
    },
  }

  if (opts.autoplay ?? true) {
    // let the first layout settle before the clock starts
    requestAnimationFrame(() => {
      if (!disposed) play()
    })
  }
  return player
}
