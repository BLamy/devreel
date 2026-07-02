import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { createTimeline, type Act, type Sample, type Timeline } from './timeline'
import { createPlayer, type Player } from './player'
import { createNarrator, type Narrator } from './narrator'
import { font, ink, surface } from './theme'

export interface SceneCtx {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>
  width: number
  height: number
  tl: Timeline
}

export interface SceneProps {
  title?: string
  acts: Act[]
  /** Build the scene graph once; return the per-frame draw. */
  setup: (ctx: SceneCtx) => (s: Sample) => void
  width?: number
  height?: number
  autoplay?: boolean
  loop?: boolean
}

/**
 * The shared stage: responsive 16:9 SVG + player chrome (play/pause, scrubber
 * with act tick marks, current-act label). Playback mutates the SVG via d3 —
 * React re-renders only on play/pause state changes.
 */
export function Scene({
  title,
  acts,
  setup,
  width = 960,
  height = 540,
  autoplay = true,
  loop = true,
}: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const actRef = useRef<HTMLSpanElement>(null)
  const playerRef = useRef<Player | null>(null)
  const narratorRef = useRef<Narrator | null>(null)
  const [playing, setPlaying] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)

  const tl = useMemo(() => createTimeline(acts), [acts])

  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()
    const defs = svg.append('defs')
    const draw = setup({ svg, defs, width, height, tl })
    const player = createPlayer(tl.total, { loop, autoplay })
    playerRef.current = player
    const narrator = createNarrator(true)
    narratorRef.current = narrator
    let lastAct = -1
    const off = player.onFrame((time) => {
      const s = tl.sample(time)
      draw(s)
      if (fillRef.current) fillRef.current.style.width = `${s.progress * 100}%`
      if (actRef.current) actRef.current.textContent = s.name
      if (s.index !== lastAct) {
        lastAct = s.index
        // narrate act openings during playback; scrubbing while paused stays silent
        if (player.playing()) narrator.speak(acts[s.index].say ?? '')
      }
    })
    player.onState((p) => {
      setPlaying(p)
      if (!p) narrator.cancel()
    })
    player.seek(0)
    return () => {
      off()
      player.dispose()
      narrator.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl])

  const seekFromPointer = (e: React.PointerEvent) => {
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    playerRef.current?.seek(frac * tl.total)
  }

  return (
    <div
      style={{
        background: surface,
        borderRadius: 12,
        overflow: 'hidden',
        width: `min(${width}px, 94vw)`,
        fontFamily: font.ui,
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        border: `1px solid ${ink.grid}`,
      }}
    >
      {title && (
        <div style={{ padding: '14px 18px 0', color: ink.primary, fontSize: 16, fontWeight: 600 }}>
          {title}
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', display: 'block' }}
        role="img"
        aria-label={title}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px 14px' }}>
        <button
          onClick={() => playerRef.current?.toggle()}
          aria-label={playing ? 'Pause' : 'Play'}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            border: `1px solid ${ink.axis}`,
            background: 'transparent',
            color: ink.primary,
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          onClick={() => {
            const next = !voiceOn
            setVoiceOn(next)
            narratorRef.current?.setEnabled(next)
            // enabling counts as the user gesture Chrome needs — speak the current act
            if (next && playerRef.current?.playing()) {
              const s = tl.sample(playerRef.current.time())
              narratorRef.current?.speak(acts[s.index].say ?? '')
            }
          }}
          aria-label={voiceOn ? 'Mute narration' : 'Enable narration'}
          title="In-browser narration (ElevenLabs in production)"
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            border: `1px solid ${ink.axis}`,
            background: 'transparent',
            color: voiceOn ? ink.primary : ink.muted,
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {voiceOn ? '🔊' : '🔇'}
        </button>
        <div
          ref={barRef}
          onPointerDown={(e) => {
            try {
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            } catch {
              // synthetic events / older browsers: dragging falls back to buttons-check
            }
            seekFromPointer(e)
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1) seekFromPointer(e)
          }}
          style={{
            position: 'relative',
            flex: 1,
            height: 8,
            borderRadius: 4,
            background: ink.grid,
            cursor: 'pointer',
            touchAction: 'none',
          }}
        >
          <div
            ref={fillRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '0%',
              borderRadius: 4,
              background: `linear-gradient(90deg, #3d7ea6, #58C4DD)`,
              pointerEvents: 'none',
            }}
          />
          {tl.starts.slice(1).map((ms, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${(ms / tl.total) * 100}%`,
                top: -2,
                bottom: -2,
                width: 2,
                background: ink.axis,
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>
        <span
          ref={actRef}
          style={{ color: ink.secondary, fontSize: 13, minWidth: 150, textAlign: 'right' }}
        />
      </div>
    </div>
  )
}
