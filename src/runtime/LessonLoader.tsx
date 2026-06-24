import { useEffect, useState } from 'react'
import type { Lesson } from '../lesson/types'
import { Player } from './Player'

interface LibEntry {
  slug: string
  title: string
  series?: string
  seriesOrder?: number
}
interface SeriesInfo {
  title: string
  part: number
  total: number
  next: LibEntry | null
}

// Loads a baked lesson and plays it. If the lesson belongs to a series, shows a
// series strip and auto-advances to the next part when it ends (watch back-to-back).
export function LessonLoader({ slug, layout }: { slug: string; layout?: 'horizontal' | 'vertical' }) {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [series, setSeries] = useState<SeriesInfo | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLesson(null)
    setSeries(null)
    setError('')

    fetch(`/generated/${slug}/lesson.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`lesson "${slug}" not found (${r.status})`)
        return r.json()
      })
      .then((l: Lesson) => !cancelled && setLesson(l))
      .catch((e) => !cancelled && setError(e.message))

    fetch('/generated/library.json')
      .then((r) => (r.ok ? r.json() : { lessons: [] }))
      .then((lib: { lessons: LibEntry[] }) => {
        if (cancelled) return
        const me = lib.lessons.find((l) => l.slug === slug)
        if (!me?.series) return
        const sibs = lib.lessons
          .filter((l) => l.series === me.series)
          .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0))
        const part = sibs.findIndex((l) => l.slug === slug)
        setSeries({ title: me.series, part: part + 1, total: sibs.length, next: sibs[part + 1] ?? null })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [slug])

  if (error) return <Centered>⚠️ {error}</Centered>
  if (!lesson) return <Centered>loading lesson…</Centered>

  const goNext = series?.next ? () => { window.location.search = `?lesson=${series.next!.slug}` } : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0b1220' }}>
      {series && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid #1e293b', color: '#e2e8f0', font: '13px system-ui' }}>
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>🎬 {series.title}</span>
          <span style={{ color: '#94a3b8' }}>Part {series.part} of {series.total}</span>
          {series.next && (
            <a href={`?lesson=${series.next.slug}`} style={{ marginLeft: 'auto', color: '#94a3b8', textDecoration: 'none' }}>
              Up next: {series.next.title} →
            </a>
          )}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Player lesson={lesson} layout={layout} onEnded={goNext} />
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8', font: '14px system-ui', background: '#0b1220' }}>
      {children}
    </div>
  )
}
