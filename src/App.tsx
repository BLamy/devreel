import { BootProbe } from './dev/BootProbe'
import { Player } from './runtime/Player'
import { LessonLoader } from './runtime/LessonLoader'
import { Feed } from './feed/Feed'
import { sampleLesson } from './lessons/sample'
import { toolsDemo } from './lessons/toolsDemo'
import { lesson as effectLesson } from './lessons/effect-basics.lesson.mjs'
import { lesson as effectNodeLesson } from './lessons/effect-node.lesson.mjs'
import { lesson as ddSmokeLesson } from './lessons/dd-smoke.lesson.mjs'

// Routing:
//   default             → the feed homepage (YouTube grid / TikTok swipe)
//   ?lesson=<slug>      → watch page: baked lesson with real ElevenLabs narration
//   ?sample=basic|tools → in-memory dev lessons (timer clock, no audio)
//   ?probe              → almostnode boot probe
// Add &layout=vertical for the reel (9:16) layout.
export default function App() {
  const params = new URLSearchParams(window.location.search)
  const layout = params.get('layout') === 'vertical' ? 'vertical' : 'horizontal'
  if (params.has('probe')) return <BootProbe />
  if (params.get('sample') === 'tools') return <Player lesson={toolsDemo} layout={layout} />
  if (params.get('sample') === 'basic') return <Player lesson={sampleLesson} layout={layout} />
  if (params.get('sample') === 'effect') return <Player lesson={effectLesson} layout={layout} />
  if (params.get('sample') === 'effect-node') return <Player lesson={effectNodeLesson} layout={layout} />
  if (params.get('sample') === 'dd') return <Player lesson={ddSmokeLesson} layout={layout} />
  const slug = params.get('lesson')
  if (slug) return <LessonLoader slug={slug} layout={layout} />
  return <Feed />
}
