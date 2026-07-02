import type { SceneCtx } from './Scene'
import type { Act, Sample } from './timeline'

/**
 * A registrable animation: what the Storybook Scene player AND the lesson
 * runtime's VizPane both consume. Lessons reference definitions by `id` and
 * drive one act per lesson-scene (`{ tool: 'viz', animation: id, act: name }`),
 * with the lesson's own narration replacing the acts' `say` lines.
 */
export interface VizDefinition {
  /** kebab-case id used by lesson actions and the manifest */
  id: string
  title: string
  /** one-line description for the lesson-authoring catalog */
  summary: string
  acts: Act[]
  setup: (ctx: SceneCtx) => (s: Sample) => void
}
