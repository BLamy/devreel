import { useEffect, useMemo, useRef, useState } from 'react'
import type { DatabaseAction, Lesson, PreviewAction, TerminalAction, ToolKind } from '../lesson/types'
import { EditorPane } from '../panes/EditorPane'
import { PreviewPane } from '../panes/PreviewPane'
import { DiagramPane } from '../panes/DiagramPane'
import { DbPane } from '../panes/DbPane'
import { TerminalPane } from '../panes/TerminalPane'
import { computeEditorView, openFiles } from './editorState'
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
  /** When true, unmute (the feed flips this after the first user gesture). */
  forceUnmute?: boolean
  /** Called when the lesson finishes (used to auto-advance a series). */
  onEnded?: () => void
}

// The director: a unified clock (audio MP3 when present, else an autoplay timer)
// drives a scene index + intra-scene progress, which puppets the focused tool.
export function Player({ lesson, layout = 'horizontal', autoplay = true, startMuted = false, chrome = 'full', exposeNav, forceUnmute, onEnded }: PlayerProps) {
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
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
          if (chrome === 'minimal') return 0 // loop in the feed
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
    const onEnd = () => {
      if (chrome === 'minimal') {
        // Loop the card like a short-form feed video.
        a.currentTime = 0
        setClock(0)
        void a.play().catch(() => {})
      } else if (onEndedRef.current) {
        setPlaying(false)
        onEndedRef.current()
      } else {
        setPlaying(false)
      }
    }
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

  // The feed flips forceUnmute once the user interacts; unmute the live audio.
  useEffect(() => {
    if (forceUnmute) setMuted(false)
  }, [forceUnmute])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (!playing) {
      a.pause()
      return
    }
    // Resilient autoplay: play() can transiently reject if it races the audio
    // load or a remount, so retry on `canplay`. Only surrender (to show the
    // play-with-sound gesture overlay) when we actually need sound — a muted
    // feed card should keep trying rather than get stuck.
    let cancelled = false
    const attempt = () => {
      if (cancelled) return
      a.play().catch(() => {
        if (!a.muted) setPlaying(false)
      })
    }
    attempt()
    a.addEventListener('canplay', attempt)
    return () => {
      cancelled = true
      a.removeEventListener('canplay', attempt)
    }
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

  const hasEditor = useMemo(() => lesson.scenes.some((s) => s.focus === 'editor'), [lesson])
  // Output tools (everything that pairs with the code), in display priority.
  const outputTools = useMemo<ToolKind[]>(
    () => (['preview', 'diagram', 'database', 'terminal'] as ToolKind[]).filter((t) => lesson.scenes.some((s) => s.focus === t)),
    [lesson],
  )
  // The output pane to show now: the current scene's output focus, else the most
  // recent one (so the code+output pairing persists while editor scenes play).
  const activeOutput = useMemo<ToolKind | null>(() => {
    for (let i = index; i >= 0; i--) {
      const f = lesson.scenes[i]?.focus
      if (f && f !== 'editor' && outputTools.includes(f)) return f
    }
    return outputTools[0] ?? null
  }, [index, lesson, outputTools])

  const vertical = layout === 'vertical'
  // Code + output shown together (split) when the lesson has both. Stack on
  // mobile (vertical), side-by-side on desktop. Single pane only when there's no
  // editor (e.g. a tool tour) — minimizes full-screen swaps.
  const split = hasEditor && outputTools.length > 0
  const editorFrac = vertical ? lesson.stage?.mobileEditor ?? 0.6 : lesson.stage?.editor ?? 0.58

  // Don't show the output while we're still writing code: keep the editor full
  // until the first output scene, then pop the output pane in. Pre-mount one
  // scene early so it boots behind the scenes and is ready when it appears.
  const firstOutputIndex = useMemo(
    () => lesson.scenes.findIndex((s) => s.focus && s.focus !== 'editor' && outputTools.includes(s.focus)),
    [lesson, outputTools],
  )
  const outputMounted = split && firstOutputIndex >= 0 && index >= Math.max(0, firstOutputIndex - 1)
  const outputShown = split && firstOutputIndex >= 0 && index >= firstOutputIndex

  // Editor's current file (complete only) → hot-reloads the live preview via HMR.
  const liveFiles = editorView && !editorView.typing ? { [editorView.file]: editorView.content } : undefined

  const tabs = useMemo(() => openFiles(lesson, index), [lesson, index])
  const editorNode = (
    <EditorPane
      file={editorView?.file ?? 'untitled.tsx'}
      content={editorView?.content ?? ''}
      callouts={editorView?.callouts}
      diagnostics={editorView?.diagnostics}
      reveal={editorView?.reveal}
      tabs={tabs}
    />
  )
  // All used output panes mounted persistently; shown when active.
  const outputNodes = outputTools.map((tool) => (
    <div key={tool} style={{ position: 'absolute', inset: 0, display: activeOutput === tool ? 'block' : 'none' }}>
      {tool === 'preview' && <PreviewPane files={lesson.workspace.files} port={lesson.workspace.previewPort} action={previewAction} actionNonce={index} liveFiles={liveFiles} />}
      {tool === 'diagram' && <DiagramPane lesson={lesson} sceneIndex={index} />}
      {tool === 'database' && <DbPane schema={lesson.workspace.dbSchema} action={dbAction} actionNonce={index} />}
      {tool === 'terminal' && <TerminalPane files={lesson.workspace.files} action={terminalAction} actionNonce={index} />}
    </div>
  ))
  const ring = (active: boolean): React.CSSProperties =>
    active ? { boxShadow: 'inset 0 0 0 2px #38bdf8' } : { opacity: 0.96 }

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

      {/* Stage: code + output shown together (split), or a single pane. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {split ? (
          <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', height: '100%', width: '100%' }}>
            <div
              style={{
                // Fill fully until the output is shown (a single flex item with
                // grow<1 only fills that fraction), then share with the output.
                flexGrow: outputShown ? editorFrac : 1,
                flexShrink: 1,
                flexBasis: 0,
                minWidth: 0,
                minHeight: 0,
                position: 'relative',
                transition: 'flex-grow 0.45s cubic-bezier(0.22,1,0.36,1)',
                ...ring(focus === 'editor'),
              }}
            >
              {editorNode}
            </div>
            {outputMounted && (
              <div
                style={{
                  flexGrow: outputShown ? 1 - editorFrac : 0.0001,
                  flexShrink: 1,
                  flexBasis: 0,
                  minWidth: 0,
                  minHeight: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  background: '#0b1220',
                  transition: 'flex-grow 0.45s cubic-bezier(0.22,1,0.36,1)',
                  ...(vertical ? { borderTop: '1px solid #1e293b' } : { borderLeft: '1px solid #1e293b' }),
                  ...ring(outputShown && focus !== 'editor'),
                }}
              >
                {outputNodes}
              </div>
            )}
          </div>
        ) : hasEditor ? (
          <div style={{ position: 'absolute', inset: 0 }}>{editorNode}</div>
        ) : (
          <div style={{ position: 'absolute', inset: 0 }}>{outputNodes}</div>
        )}
        {!scene?.action && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center',
              padding: 32, zIndex: 4,
              background: `linear-gradient(135deg, ${lesson.accent || '#1f6fb2'} 0%, #0b1220 82%)`,
            }}
          >
            <div>
              {scene?.chapter && (
                <div style={{ textTransform: 'uppercase', letterSpacing: 2, fontSize: 11, color: 'rgba(255,255,255,0.85)', marginBottom: 10 }}>{scene.chapter}</div>
              )}
              <div style={{ fontSize: vertical ? 30 : 42, fontWeight: 800, color: '#fff', lineHeight: 1.15 }}>{lesson.title}</div>
              {lesson.subtitle && <div style={{ opacity: 0.85, marginTop: 10, fontSize: vertical ? 15 : 17, color: '#e2e8f0' }}>{lesson.subtitle}</div>}
              <div style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{lesson.library} · {lesson.persona}</div>
            </div>
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
