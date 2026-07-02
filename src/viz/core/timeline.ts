import { easeCubicInOut } from 'd3'

/**
 * Act-based keyframe engine — the manim substitute. An animation is a sequence
 * of named acts; the timeline maps global time to { act, eased local t }.
 * Because every frame is a pure function of time, scrubbing is free.
 */
export interface Act {
  name: string
  /** ms of animated progress 0→1 */
  duration: number
  /** ms to rest at t=1 after the motion — the 3b1b "beat" */
  hold?: number
  ease?: (t: number) => number
  /** narration line spoken when the act begins (in-browser TTS; ElevenLabs in production) */
  say?: string
}

export interface Sample {
  index: number
  name: string
  /** eased local progress 0→1 (stays 1 during hold) */
  t: number
  /** global ms, clamped to [0, total] */
  time: number
  /** global 0→1 across the whole timeline */
  progress: number
}

export interface Timeline {
  acts: Act[]
  total: number
  /** global start ms of each act */
  starts: number[]
  sample(time: number): Sample
}

export function createTimeline(acts: Act[]): Timeline {
  const starts: number[] = []
  let total = 0
  for (const a of acts) {
    starts.push(total)
    total += a.duration + (a.hold ?? 0)
  }
  const sample = (time: number): Sample => {
    const clamped = Math.max(0, Math.min(time, total))
    let index = acts.length - 1
    for (let i = 0; i < acts.length; i++) {
      const end = starts[i] + acts[i].duration + (acts[i].hold ?? 0)
      if (clamped < end) {
        index = i
        break
      }
    }
    const act = acts[index]
    const local = clamped - starts[index]
    const raw = act.duration === 0 ? 1 : Math.min(1, local / act.duration)
    const t = (act.ease ?? easeCubicInOut)(raw)
    return { index, name: act.name, t, time: clamped, progress: total === 0 ? 1 : clamped / total }
  }
  return { acts, total, starts, sample }
}

/**
 * Cumulative staging helper: 0 before the named act, its eased t during it,
 * 1 forever after. Lets draw() layer act effects without bookkeeping.
 */
export function phase(tl: Timeline, s: Sample, name: string): number {
  const i = tl.acts.findIndex((a) => a.name === name)
  if (i < 0) return 0
  if (s.index > i) return 1
  if (s.index < i) return 0
  return s.t
}
