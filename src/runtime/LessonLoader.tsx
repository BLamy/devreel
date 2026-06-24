import { useEffect, useState } from 'react'
import type { Lesson } from '../lesson/types'
import { Player } from './Player'

// Loads a baked lesson (public/generated/<slug>/lesson.json) and plays it with
// its real ElevenLabs narration + per-scene cues.
export function LessonLoader({ slug, layout }: { slug: string; layout?: 'horizontal' | 'vertical' }) {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    setLesson(null)
    setError('')
    fetch(`/generated/${slug}/lesson.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`lesson "${slug}" not found (${r.status})`)
        return r.json()
      })
      .then((l: Lesson) => {
        if (!cancelled) setLesson(l)
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [slug])

  if (error) return <Centered>⚠️ {error}</Centered>
  if (!lesson) return <Centered>loading lesson…</Centered>
  return <Player lesson={lesson} layout={layout} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8', font: '14px system-ui', background: '#0b1220' }}>
      {children}
    </div>
  )
}
