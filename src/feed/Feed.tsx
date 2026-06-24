import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from './useIsMobile'
import { LessonLoader } from '../runtime/LessonLoader'
import { Player, type PlayerNav } from '../runtime/Player'
import type { Lesson } from '../lesson/types'

export interface LibraryEntry {
  slug: string
  title: string
  subtitle?: string
  library: string
  persona?: string
  accent?: string
  durationSeconds?: number
  sceneCount?: number
  href?: string
  createdAt?: string
  format?: 'video' | 'reel'
  poster?: { file: string; code: string }
  series?: string
  seriesOrder?: number
}

function fmtDur(s?: number): string {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

// A code-tutorial thumbnail: accent backdrop + a snippet of the lesson's code.
// The lesson title is rendered by the card below the poster (YouTube-style).
function Poster({ entry, ratio }: { entry: LibraryEntry; ratio: string }) {
  const accent = entry.accent || '#1f6fb2'
  const p = entry.poster
  const small = ratio === '9 / 16'
  return (
    <div
      style={{
        aspectRatio: ratio,
        background: `linear-gradient(135deg, ${accent} 0%, #0b1220 92%)`,
        borderRadius: 12,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px' }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, fontSize: 10, color: '#fff' }}>{entry.library}</span>
        {p?.file && <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'rgba(255,255,255,0.78)' }}>{p.file.replace(/^\//, '')}</span>}
      </div>
      {p?.code ? (
        <pre
          style={{
            margin: '0 10px 10px',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            background: 'rgba(2,6,23,0.62)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 8,
            padding: '8px 10px',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: small ? 8.5 : 10.5,
            lineHeight: 1.5,
            color: '#d8e2f0',
            whiteSpace: 'pre',
          }}
        >
          {p.code}
        </pre>
      ) : (
        <div style={{ flex: 1 }} />
      )}
      <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.72)', borderRadius: 6, padding: '2px 6px', fontSize: 11, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
        {fmtDur(entry.durationSeconds)}
      </div>
    </div>
  )
}

// ── Mobile: TikTok-style vertical swipe feed ──────────────────────────────
function MobileFeed({ lessons }: { lessons: LibraryEntry[] }) {
  const [active, setActive] = useState(0)
  const [soundOn, setSoundOn] = useState(false)
  const navRef = useRef<PlayerNav | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Browsers block unmuted autoplay until the user interacts. TikTok-style: cards
  // autoplay muted, then sound turns on at the first scroll/tap and stays on.
  useEffect(() => {
    if (soundOn) return
    const enable = () => setSoundOn(true)
    const opts: AddEventListenerOptions = { once: true, passive: true }
    window.addEventListener('pointerdown', enable, opts)
    window.addEventListener('touchstart', enable, opts)
    window.addEventListener('wheel', enable, opts)
    window.addEventListener('keydown', enable, { once: true })
    return () => {
      window.removeEventListener('pointerdown', enable)
      window.removeEventListener('touchstart', enable)
      window.removeEventListener('wheel', enable)
      window.removeEventListener('keydown', enable)
    }
  }, [soundOn])

  // Deterministic active slide = the one nearest the top of the scroll viewport.
  const onScroll = () => {
    const el = containerRef.current
    if (!el || el.clientHeight === 0) return
    if (!soundOn) setSoundOn(true)
    const i = Math.max(0, Math.min(lessons.length - 1, Math.round(el.scrollTop / el.clientHeight)))
    setActive((prev) => (prev === i ? prev : i))
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="devreel-feed"
      style={{ height: '100dvh', width: '100vw', overflowY: 'scroll', scrollSnapType: 'y mandatory', background: '#000' }}
    >
      {lessons.map((e, i) => (
        <div
          key={e.slug}
          style={{ height: '100dvh', width: '100%', scrollSnapAlign: 'start', position: 'relative', background: '#0b1220' }}
        >
          {i === active ? (
            <>
              <LessonLoaderVertical slug={e.slug} soundOn={soundOn} onNav={(n) => (navRef.current = n)} />
              {/* Tap zones: right third advances a scene, the rest toggles play. */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 20 }}>
                <button aria-label="play/pause" onClick={() => { setSoundOn(true); navRef.current?.toggle() }} style={tapZone(65)} />
                <button aria-label="next scene" onClick={() => { setSoundOn(true); navRef.current?.next() }} style={tapZone(35)} />
              </div>
              <div style={{ position: 'absolute', top: 10, left: 12, color: '#fff', fontSize: 12, opacity: 0.85, zIndex: 21, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                {soundOn ? '🔊 sound on' : '🔇 tap for sound'} · tap right ▸ next · swipe up
              </div>
            </>
          ) : (
            <div style={{ position: 'absolute', inset: 0, padding: 16, display: 'grid', placeItems: 'center' }}>
              <div style={{ width: '70%', maxWidth: 320 }}>
                <Poster entry={e} ratio="9 / 16" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function tapZone(pct: number): React.CSSProperties {
  return { flex: `0 0 ${pct}%`, background: 'transparent', border: 'none', cursor: 'pointer' }
}

// Vertical player that also surfaces nav up to the mobile feed.
function LessonLoaderVertical({ slug, soundOn, onNav }: { slug: string; soundOn: boolean; onNav: (n: PlayerNav) => void }) {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`/generated/${slug}/lesson.json`)
      .then((r) => r.json())
      .then((l) => !cancelled && setLesson(l))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug])
  if (!lesson) return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>loading…</div>
  // Always start muted so autoplay is allowed; unmute once the user has interacted.
  return <Player lesson={lesson} layout="vertical" autoplay startMuted chrome="minimal" forceUnmute={soundOn} exposeNav={onNav} />
}

// A feed item is a standalone lesson or a whole series (grouped into one card).
interface FeedItem {
  rep: LibraryEntry // the part-1 lesson used for the thumbnail + link
  series?: string
  parts: number
  totalDuration: number
}

// Group series into a single card; keep standalone lessons individual.
function groupItems(lessons: LibraryEntry[]): FeedItem[] {
  const items: FeedItem[] = []
  const seen = new Set<string>()
  for (const l of lessons) {
    if (l.series) {
      if (seen.has(l.series)) continue
      seen.add(l.series)
      const parts = lessons.filter((x) => x.series === l.series).sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0))
      items.push({ rep: parts[0], series: l.series, parts: parts.length, totalDuration: parts.reduce((s, p) => s + (p.durationSeconds ?? 0), 0) })
    } else {
      items.push({ rep: l, parts: 1, totalDuration: l.durationSeconds ?? 0 })
    }
  }
  return items
}

function Card({ item, ratio }: { item: FeedItem; ratio: string }) {
  const e = item.rep
  const title = item.series ?? e.title
  const meta = item.series
    ? `${item.parts}-part series · ${e.library}`
    : `${e.persona} · ${e.library}${e.sceneCount ? ` · ${e.sceneCount} scenes` : ''}`
  return (
    <a href={`?lesson=${e.slug}`} style={ratio === '9 / 16' ? { ...cardLink, width: 150, flex: '0 0 auto' } : cardLink}>
      <div style={{ position: 'relative' }}>
        <Poster entry={{ ...e, durationSeconds: item.totalDuration }} ratio={ratio} />
        {item.series && (
          <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(56,189,248,0.92)', color: '#04222e', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6 }}>
            SERIES · {item.parts}
          </span>
        )}
      </div>
      <div style={cardTitle}>{title}</div>
      <div style={cardMeta}>{meta}</div>
    </a>
  )
}

// ── Desktop: YouTube-style grid + reels rail ──────────────────────────────
function DesktopFeed({ lessons }: { lessons: LibraryEntry[] }) {
  const items = groupItems(lessons)
  const reels = items.filter((i) => i.rep.format === 'reel')
  const videos = items.filter((i) => i.rep.format !== 'reel')
  return (
    <div style={{ minHeight: '100vh', background: '#0b1220', color: '#e2e8f0' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, background: 'rgba(11,18,32,0.95)', backdropFilter: 'blur(6px)', zIndex: 10 }}>
        <strong style={{ fontSize: 20, color: '#38bdf8' }}>▶ devreel</strong>
        <div style={{ flex: 1, maxWidth: 520, margin: '0 auto', background: '#111c2e', border: '1px solid #1e293b', borderRadius: 999, padding: '8px 16px', color: '#64748b', fontSize: 14 }}>
          Search tutorials…
        </div>
      </header>

      {reels.length > 0 && (
        <section style={{ padding: '20px 24px 0' }}>
          <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>🎬 Reels</h2>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
            {reels.map((i) => <Card key={i.rep.slug} item={i} ratio="9 / 16" />)}
          </div>
        </section>
      )}

      <section style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 14px' }}>Videos</h2>
        {videos.length === 0 ? (
          <div style={{ color: '#64748b' }}>No lessons yet — run <code>/new-lesson</code> to add one.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {videos.map((i) => <Card key={i.rep.slug} item={i} ratio="16 / 9" />)}
          </div>
        )}
      </section>
    </div>
  )
}

const cardLink: React.CSSProperties = { textDecoration: 'none', color: 'inherit', display: 'block' }
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, marginTop: 8, lineHeight: 1.25 }
const cardMeta: React.CSSProperties = { fontSize: 12, color: '#94a3b8', marginTop: 2 }

export function Feed() {
  const isMobile = useIsMobile()
  const [lessons, setLessons] = useState<LibraryEntry[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/generated/library.json')
      .then((r) => (r.ok ? r.json() : { lessons: [] }))
      .then((lib) => setLessons(Array.isArray(lib.lessons) ? lib.lessons : []))
      .catch((e) => setError(String(e)))
  }, [])

  if (error) return <Centered>⚠️ {error}</Centered>
  if (!lessons) return <Centered>loading feed…</Centered>
  if (lessons.length === 0) return <DesktopFeed lessons={[]} />
  return isMobile ? <MobileFeed lessons={lessons} /> : <DesktopFeed lessons={lessons} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ height: '100vh', display: 'grid', placeItems: 'center', color: '#94a3b8', background: '#0b1220', font: '14px system-ui' }}>{children}</div>
}
