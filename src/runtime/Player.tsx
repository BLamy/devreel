import { useEffect, useMemo, useRef, useState } from 'react'
import type { DatabaseAction, Lesson, PreviewAction, TerminalAction, ToolKind } from '../lesson/types'
import { EditorPane } from '../panes/EditorPane'
import { PreviewPane } from '../panes/PreviewPane'
import { DiagramPane } from '../panes/DiagramPane'
import { DbPane } from '../panes/DbPane'
import { TerminalPane } from '../panes/TerminalPane'
import { computeEditorView } from './editorState'
import { renderInlineMarkdown } from './markdown'

const DEFAULT_SCENE_MS = 4500

export interface PlayerNav {
  next: () => void
  prev: () => void
  toggle: () => void
}

export interface PlayerProps {
  lesson: Lesson
  /** 'horizontal' (YouTube 16:9) or 'vertical' (reel 9:16). */
  layout?: 'horizontal' | 'vertical'
  /** Start playing on mount (default true). */
  autoplay?: boolean
  /** Start muted — required for unattended autoplay in the feed (default false). */
  startMuted?: boolean
  /** 'full' shows header + transport; 'minimal' (feed) shows just stage + caption. */
  chrome?: 'full' | 'minimal'
  /** Receive imperative nav so a parent (the feed) can drive next/prev/toggle. */
  exposeNav?: (nav: PlayerNav) => void
}

// The director: a unified clock (audio MP3 when present, else an autoplay timer)
// drives a scene index + intra-scene progress, which puppets the focused tool.
export function Player({ lesson, layout = 'horizontal', autoplay = true, startMuted = false, chrome = 'full', exposeNav }: PlayerProps) {
  // Per-scene start times + total, in ms.
  const { starts, total } = useMemo(() => {
    const n = lesson.scenes.length
    if (lesson.cueTimes && lesson.durationSeconds) {
      return {
        starts: lesson.cueTimes.map((t) => t * 1000),
        total: lesson.durationSeconds * 1000,
      }
    }
    const s: number[] = []
    let acc = 0
    for (let i = 0; i < n; i++) {
      s.push(acc)
      acc += lesson.scenes[i].autoAdvanceMs ?? DEFAULT_SCENE_MS
    }
    return { starts: s, total: acc }
  }, [lesson])

  const [clock, setClock] = useState(0)
  const [playing, setPlaying] = useState(autoplay)
  const [muted, setMuted] = useState(startMuted)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasAudio = !!lesson.audio

  // Derive scene index + progress.
  const index = useMemo(() => {
    let idx = 0
    for (let i = 0; i < starts.length; i++) {
      if (clock >= starts[i] - 20) idx = i
      else break
    }
    return idx
  }, [clock, starts])
  const sceneStart = starts[index] ?? 0
  const sceneEnd = starts[index + 1] ?? total
  const progress = Math.max(0, Math.min(1, sceneEnd > sceneStart ? (clock - sceneStart) / (sceneEnd - sceneStart) : 1))

  // Fallback timer clock (no audio): advance via rAF while playing.
  useEffect(() => {
    if (hasAudio || !playing) return
    let raf = 0
    let lastTs = performance.now()
    const tick = (ts: number) => {
      const dt = ts - lastTs
      lastTs = ts
      setClock((c) => {
        const next = c + dt
        if (next >= total) {
          setPlaying(false)
          return total
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hasAudio, playing, total])

  // Audio clock.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setClock(a.currentTime * 1000)
    const onEnd = () => setPlaying(false)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
    }
  }, [hasAudio])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.muted = muted
  }, [muted])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    // If the browser blocks unmuted autoplay, fall back to paused so the
    // play-with-sound overlay shows (a click is a trusted gesture).
    if (playing) a.play().catch(() => setPlaying(false))
    else a.pause()
  }, [playing])

  // Show a play overlay only when audio hasn't started and we're not playing.
  const needsGesture = hasAudio && !playing && clock < 100

  const seek = (ms: number) => {
    const clamped = Math.max(0, Math.min(total, ms))
    setClock(clamped)
    if (audioRef.current) audioRef.current.currentTime = clamped / 1000
  }
  const goScene = (i: number) => seek(starts[Math.max(0, Math.min(starts.length - 1, i))] ?? 0)

  // Let a parent (the feed) drive navigation, e.g. tap-right to advance a scene.
  useEffect(() => {
    exposeNav?.({
      next: () => goScene(index + 1),
      prev: () => goScene(index - 1),
      toggle: () => setPlaying((p) => !p),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exposeNav, index, total])

  const scene = lesson.scenes[index]
  const focus: ToolKind = scene?.focus ?? 'editor'
  const editorView = computeEditorView(lesson, index, progress)
  const previewAction: PreviewAction | null = scene?.action?.tool === 'preview' ? (scene.action as PreviewAction) : null
  const dbAction: DatabaseAction | null = scene?.action?.tool === 'database' ? (scene.action as DatabaseAction) : null
  const terminalAction: TerminalAction | null = scene?.action?.tool === 'terminal' ? (scene.action as TerminalAction) : null

  const usesPreview = useMemo(() => lesson.scenes.some((s) => s.focus === 'preview'), [lesson])
  const usesDiagram = useMemo(() => lesson.scenes.some((s) => s.focus === 'diagram'), [lesson])
  const usesDb = useMemo(() => lesson.scenes.some((s) => s.focus === 'database'), [lesson])
  const usesTerminal = useMemo(() => lesson.scenes.some((s) => s.focus === 'terminal'), [lesson])

  const vertical = layout === 'vertical'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#0b1220',
        color: '#e2e8f0',
        ...(vertical ? { maxWidth: 'calc(100vh * 9 / 16)', margin: '0 auto' } : {}),
      }}
    >
      {/* Header */}
      {chrome === 'full' && (
        <div style={{ padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'baseline', borderBottom: '1px solid #1e293b' }}>
          <strong style={{ fontSize: 15 }}>{lesson.title}</strong>
          <span style={{ color: '#64748b', fontSize: 12 }}>{lesson.library}</span>
          <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12 }}>
            scene {index + 1}/{lesson.scenes.length} · {focus}
          </span>
        </div>
      )}

      {/* Stage: focused pane (both kept mounted to preserve editor + live preview) */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: focus === 'editor' ? 'block' : 'none' }}>
          <EditorPane
            file={editorView?.file ?? 'untitled.tsx'}
            content={editorView?.content ?? ''}
            callouts={editorView?.callouts}
            diagnostics={editorView?.diagnostics}
            reveal={editorView?.reveal}
          />
        </div>
        {usesPreview && (
          <div style={{ position: 'absolute', inset: 0, display: focus === 'preview' ? 'block' : 'none' }}>
            <PreviewPane files={lesson.workspace.files} port={lesson.workspace.previewPort} action={previewAction} actionNonce={index} />
          </div>
        )}
        {usesDiagram && (
          <div style={{ position: 'absolute', inset: 0, display: focus === 'diagram' ? 'block' : 'none' }}>
            <DiagramPane lesson={lesson} sceneIndex={index} />
          </div>
        )}
        {usesDb && (
          <div style={{ position: 'absolute', inset: 0, display: focus === 'database' ? 'block' : 'none' }}>
            <DbPane schema={lesson.workspace.dbSchema} action={dbAction} actionNonce={index} />
          </div>
        )}
        {usesTerminal && (
          <div style={{ position: 'absolute', inset: 0, display: focus === 'terminal' ? 'block' : 'none' }}>
            <TerminalPane files={lesson.workspace.files} action={terminalAction} actionNonce={index} />
          </div>
        )}
        {needsGesture && chrome === 'full' && (
          <button
            onClick={() => { setMuted(false); setPlaying(true) }}
            style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              background: 'rgba(2,6,23,0.55)', border: 'none', cursor: 'pointer', color: '#fff',
            }}
          >
            <span style={{ fontSize: 17, display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(15,23,42,0.9)', padding: '14px 22px', borderRadius: 999 }}>
              ▶ Play with sound
            </span>
          </button>
        )}
      </div>

      {/* Caption */}
      <div style={{ padding: '14px 18px', background: 'rgba(2,6,23,0.92)', borderTop: '1px solid #1e293b', minHeight: 64 }}>
        {scene?.chapter && (
          <div style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, color: '#38bdf8', marginBottom: 4 }}>{scene.chapter}</div>
        )}
        <div style={{ fontSize: vertical ? 18 : 16, lineHeight: 1.45 }}>
          {scene ? renderInlineMarkdown(scene.narration) : null}
        </div>
      </div>

      {/* Transport */}
      {chrome === 'full' && (
      <div style={{ padding: '8px 14px', display: 'flex', gap: 10, alignItems: 'center', background: '#0b1220', borderTop: '1px solid #1e293b' }}>
        <button onClick={() => goScene(index - 1)} style={btn}>◂ prev</button>
        <button onClick={() => setPlaying((p) => !p)} style={{ ...btn, minWidth: 70 }}>{playing ? '❚❚ pause' : '▶ play'}</button>
        <button onClick={() => goScene(index + 1)} style={btn}>next ▸</button>
        {hasAudio && (
          <button onClick={() => setMuted((m) => !m)} style={btn} title={muted ? 'unmute' : 'mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
        )}
        <input
          type="range"
          min={0}
          max={total}
          value={clock}
          onChange={(e) => seek(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#94a3b8', minWidth: 84, textAlign: 'right' }}>
          {(clock / 1000).toFixed(1)}s / {(total / 1000).toFixed(1)}s
        </span>
      </div>
      )}

      {hasAudio && <audio ref={audioRef} src={lesson.audio} preload="auto" muted={muted} />}
    </div>
  )
}

const btn: React.CSSProperties = {
  background: '#1e293b',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 13,
  cursor: 'pointer',
}
