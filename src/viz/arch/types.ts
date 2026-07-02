// Declarative architecture-diagram spec — the "dumb-model-proof" primitive.
// An authoring model (or a human) fills in plain data: nodes with kinds from
// the vocabulary below, optional containment groups (region / AZ / VPC / …),
// edges, and *flows* — named request/response sequences. The builder
// (build.ts) turns the spec into a standard VizDefinition whose acts are
// [intro, ...flows], so lessons drive it exactly like any other animation.
//
// Coordinates are in the 960×540 viewBox. Keep node x in [70, 890] and
// y in [80, 460]; groups are rectangles that visually contain their nodes.

/** Node vocabulary, grouped by color family. */
export type ArchKind =
  // clients (blue)
  | 'browser'
  | 'mobile'
  | 'client'
  | 'iot'
  // edge & network (teal)
  | 'cdn'
  | 'dns'
  | 'loadbalancer'
  | 'apigateway'
  | 'edge-function'
  | 'waf'
  | 'proxy'
  // compute (yellow)
  | 'server'
  | 'service'
  | 'container'
  | 'kubernetes'
  | 'lambda'
  | 'vm'
  | 'worker'
  | 'cron'
  // data (purple)
  | 'database'
  | 'replica'
  | 'cache'
  | 'queue'
  | 'topic'
  | 'blob'
  | 'search'
  | 'warehouse'
  | 'vector-db'
  // integration (gold)
  | 'external'
  | 'webhook'
  | 'auth'
  | 'secrets'
  | 'email'
  | 'payments'
  // observability & delivery (pink)
  | 'metrics'
  | 'logs'
  | 'alerts'
  | 'repo'
  | 'ci'
  | 'artifact'

export type GroupKind =
  | 'region'
  | 'az'
  | 'vpc'
  | 'subnet'
  | 'edge-network'
  | 'cluster'
  | 'account'
  | 'onprem'
  | 'platform' // e.g. "Vercel", "Cloudflare"

export interface ArchNode {
  id: string
  label: string
  kind: ArchKind
  /** small second line, e.g. "us-east-1a" / "Node 20" / "p95 12ms" */
  sublabel?: string
  x: number
  y: number
}

export interface ArchGroup {
  id: string
  label: string
  kind: GroupKind
  x: number
  y: number
  w: number
  h: number
}

export interface ArchEdge {
  from: string
  to: string
  label?: string
  /** dashed = async / eventual / background */
  dashed?: boolean
}

export type StepKind = 'request' | 'response' | 'data' | 'event' | 'error'

/** One hop of a flow: a pulse travels from → to with an optional label. */
export interface ArchStep {
  from: string
  to: string
  label?: string
  kind?: StepKind
}

/** A named story beat = one act. Steps animate sequentially across the act. */
export interface ArchFlow {
  name: string
  /** act duration ms (default 900ms per step + 1200) */
  duration?: number
  hold?: number
  /** narration line for the Storybook player (lessons author their own) */
  say?: string
  caption?: string
  steps: ArchStep[]
  /** nodes marked failed for this act and all later acts (red ✕, desaturated) */
  fail?: string[]
  /** clear earlier failures at the start of this act */
  recover?: string[]
  /** badges shown once the act completes, e.g. latency or status callouts */
  badges?: { node: string; text: string; tone?: 'ok' | 'warn' | 'err' }[]
}

export interface ArchSpec {
  id: string
  title: string
  summary: string
  /** the intro act draws the diagram; name defaults to "the architecture" */
  intro?: { name?: string; say?: string; caption?: string; duration?: number }
  groups?: ArchGroup[]
  nodes: ArchNode[]
  edges: ArchEdge[]
  flows: ArchFlow[]
}
