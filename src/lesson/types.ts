// ---------------------------------------------------------------------------
// Lesson spec — the declarative format the devreel runtime renders.
//
// A Lesson is a real almostnode workspace + a timeline of Scenes. Each scene
// focuses one *tool* (editor / preview / terminal / database / diagram) and
// carries a puppet *action* the director executes against the live workspace,
// paced to the narration MP3 (see align.ts). The authoring agent produces one
// Lesson object; the runtime never changes.
//
// The `diagram` tool reuses orly's Story model verbatim, so the original
// architectural data-flow view is preserved as a first-class scene kind.
// ---------------------------------------------------------------------------

// ── Diagram model (kept from orly / almostnode learn) ──────────────────────

export type NodeKind =
  | 'client' | 'loadbalancer' | 'service' | 'database' | 'cache' | 'queue'
  | 'worker' | 'external' | 'vault' | 'key' | 'proxy' | 'record'

export interface DiagramNode {
  id: string
  label: string
  kind: NodeKind
  /** 0–100 coordinate space; auto-laid-out by the validator if omitted. */
  x?: number
  y?: number
  sublabel?: string
}

export interface DiagramEdge {
  id: string
  from: string
  to: string
  label?: string
  dashed?: boolean
}

export type MessageKind = 'request' | 'response' | 'data' | 'event'

export interface Message {
  from: string
  to: string
  label?: string
  kind?: MessageKind
  delay?: number
  duration?: number
}

export interface Badge {
  node: string
  text: string
  tone?: 'ok' | 'warn' | 'info'
}

// ── Tools + scene actions ──────────────────────────────────────────────────

export type ToolKind = 'editor' | 'preview' | 'terminal' | 'database' | 'diagram'

/** Annotation anchored to a line in the editor. */
export interface Callout {
  line: number
  text: string
  kind?: 'info' | 'tip' | 'warn'
}

/** Scripted editor diagnostic (squiggle) — rendered via monaco setModelMarkers. */
export interface Diagnostic {
  line: number
  column?: number
  endColumn?: number
  message: string
  severity?: 'error' | 'warning' | 'info'
}

export interface EditorAction {
  tool: 'editor'
  /** Path (in the workspace) of the file to show this scene. */
  file: string
  /** Text appended (animated char-by-char) to the file across the scene window. */
  type?: string
  /** Replace the whole file with this content (animated if `typed`). */
  replace?: string
  /** Animate `replace`/`type` as typing rather than an instant set. Default true. */
  typed?: boolean
  /** Line range [start,end] (1-based) to scroll into view / emphasize. */
  reveal?: [number, number]
  callouts?: Callout[]
  diagnostics?: Diagnostic[]
}

/** One deterministic Playwright-style step run against the live preview. */
export interface PreviewStep {
  cmd: 'goto' | 'click' | 'fill' | 'type' | 'hover' | 'press' | 'waitFor' | 'devtools' | 'network'
  /** CSS selector for click/fill/hover/waitFor. */
  selector?: string
  /** Text for fill/type. */
  text?: string
  /** Key for press (e.g. "Enter"). */
  key?: string
  /** Path for goto (e.g. "/about"). */
  url?: string
  /** Eruda tab for devtools/network ('console' | 'network' | 'elements' | 'resources'). */
  tab?: string
  /** URL substring to highlight in the network panel. */
  match?: string
}

export interface PreviewAction {
  tool: 'preview'
  /** Ordered, deterministic commands driven against the live preview (cursor-animated). */
  steps?: PreviewStep[]
  // ── Convenience shorthands (compiled into steps when `steps` is omitted) ──
  /** Path within the preview app to (re)load. */
  navigate?: string
  /** CSS selector to click (animated cursor). */
  click?: string
  /** Open Eruda devtools to a tab ('console' | 'network' | ...). */
  openEruda?: string
  /** Open the network panel and highlight the request whose URL contains this. */
  focusNetwork?: string
}

export interface TerminalAction {
  tool: 'terminal'
  /** Command to run in the workspace terminal. */
  run?: string
  /** Substring expected in output (used by the capture/verify step). */
  expect?: string
}

export interface DatabaseAction {
  tool: 'database'
  /** SQL executed against the lesson's PGlite instance; rows are rendered. */
  query: string
  /** Optional column whose changed cells should be emphasized. */
  highlight?: string
}

export interface DiagramAction {
  tool: 'diagram'
  reveal?: string[]
  hide?: string[]
  highlight?: string[]
  activeEdges?: string[]
  messages?: Message[]
  badges?: Badge[]
}

export type SceneAction =
  | EditorAction
  | PreviewAction
  | TerminalAction
  | DatabaseAction
  | DiagramAction

// ── Scene + Lesson ─────────────────────────────────────────────────────────

export interface Scene {
  id: string
  /** Eyebrow/section label. */
  chapter?: string
  title?: string
  /** On-screen caption; supports **bold**, *italic*, `code`. */
  narration: string
  /** Plain-text override for TTS (avoid reading code/symbols literally). */
  say?: string
  /** Audio sync: a phrase to find in the transcript, or absolute seconds. */
  cue?: string | number
  /** Which pane is focused this scene. */
  focus: ToolKind
  /** The puppet action; its `tool` should match `focus`. */
  action?: SceneAction
  /** Override autoplay dwell time when there is no audio (ms). */
  autoAdvanceMs?: number
}

export interface Workspace {
  /** path -> TARGET content. Editor scenes type their way toward these. */
  files: Record<string, string>
  /** npm packages to install before the preview/terminal boot (React is free). */
  install?: string[]
  /** Port the in-browser dev server listens on. */
  previewPort?: number
  /** How the preview boots. */
  previewMode?: 'react' | 'static'
  /** Optional PGlite schema applied before database scenes. */
  dbSchema?: string
}

export interface Lesson {
  slug: string
  title: string
  subtitle?: string
  /** The library/tool being taught (e.g. "zod", "tanstack-query"). */
  library: string
  /** One-noun throughline (orly discipline). */
  throughline: string
  persona?: string
  accent?: string
  /** 'video' (long, horizontal) or 'reel' (short, vertical). Default 'video'. */
  format?: 'video' | 'reel'
  workspace: Workspace
  /** Nodes/edges for any `diagram` scenes. */
  diagram?: { nodes: DiagramNode[]; edges: DiagramEdge[] }
  scenes: Scene[]

  // ── Populated by the generator pipeline ──
  /** Relative path to the narration MP3. */
  audio?: string
  durationSeconds?: number
  /** Per-scene start times (seconds), baked from the transcript by transform. */
  cueTimes?: number[]
}
