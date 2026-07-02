import type { VizDefinition } from './core/definition'
import { definitions as linearTransformation } from './animations/LinearTransformation'
import { definition as eigenvectors } from './animations/Eigenvectors'
import { definition as svdDecomposition } from './animations/SVDDecomposition'
import { definition as fourierEpicycles } from './animations/FourierEpicycles'
import { definition as fourierWinding } from './animations/FourierWinding'
import { definitions as convolution } from './animations/Convolution'
import { definition as taylorSeries } from './animations/TaylorSeries'
import { definition as gradientDescent } from './animations/GradientDescent'
import { definition as centralLimit } from './animations/CentralLimit'
import { definition as bayesTheorem } from './animations/BayesTheorem'
import { definition as klDivergence } from './animations/KLDivergence'
import { definition as neuralNetwork } from './animations/NeuralNetwork'
import { definition as attentionMechanism } from './animations/AttentionMechanism'
import { definition as embeddingArithmetic } from './animations/EmbeddingArithmetic'
import { definition as diffusionProcess } from './animations/DiffusionProcess'
import { definition as graphBfs } from './animations/GraphBFS'
import { definition as differentialDataflow } from './animations/DifferentialDataflow'
import { definition as lib3b1bDemo } from './animations/Lib3b1bDemo'
import { archDefinitions } from './arch/catalog'
import { VIZ_MANIFEST } from './manifest.mjs'

const ALL: VizDefinition[] = [
  ...linearTransformation,
  eigenvectors,
  svdDecomposition,
  fourierEpicycles,
  fourierWinding,
  ...convolution,
  taylorSeries,
  gradientDescent,
  centralLimit,
  bayesTheorem,
  klDivergence,
  neuralNetwork,
  attentionMechanism,
  embeddingArithmetic,
  diffusionProcess,
  graphBfs,
  differentialDataflow,
  lib3b1bDemo,
  ...archDefinitions,
]

const seen = new Set<string>()
for (const d of ALL) {
  if (seen.has(d.id)) throw new Error(`[viz] duplicate animation id "${d.id}"`)
  seen.add(d.id)
}

export const VIZ_REGISTRY: Record<string, VizDefinition> = Object.fromEntries(ALL.map((d) => [d.id, d]))

export function getViz(id: string): VizDefinition | undefined {
  return VIZ_REGISTRY[id]
}

// Guard against drift between the runtime definitions and the plain-JS
// manifest the lesson generator validates against. Loud in dev, silent in prod.
if (import.meta.env?.DEV) {
  const manifest = VIZ_MANIFEST as { id: string; acts: string[] }[]
  const regIds = new Set(ALL.map((d) => d.id))
  const manIds = new Set(manifest.map((m) => m.id))
  for (const id of regIds) if (!manIds.has(id)) console.error(`[viz] "${id}" is registered but missing from manifest.mjs`)
  for (const m of manifest) {
    if (!regIds.has(m.id)) {
      console.error(`[viz] manifest lists "${m.id}" but no definition is registered`)
      continue
    }
    const acts = VIZ_REGISTRY[m.id].acts.map((a) => a.name)
    if (JSON.stringify(acts) !== JSON.stringify(m.acts)) {
      console.error(`[viz] act mismatch for "${m.id}":\n  registry: ${acts.join(' | ')}\n  manifest: ${m.acts.join(' | ')}`)
    }
  }
}
