import type { Callout, Diagnostic, EditorAction, Lesson, Scene } from '../lesson/types'

// Shared stable empties so consumers' effects don't refire on new [] identity.
const NO_CALLOUTS: Callout[] = []
const NO_DIAGS: Diagnostic[] = []

// Finish typing within the first fraction of a scene; the rest is reading time.
const TYPE_WINDOW = 0.62

export interface EditorView {
  file: string
  content: string
  callouts: Callout[]
  diagnostics: Diagnostic[]
  reveal?: [number, number]
  /** True while characters are still being typed in this scene. */
  typing: boolean
}

function isEditor(scene: Scene): scene is Scene & { action: EditorAction } {
  return scene.action?.tool === 'editor'
}

/** Ordered list of files open by this scene: seeded files first, then edited ones. */
export function openFiles(lesson: Lesson, sceneIndex: number): string[] {
  const seen: string[] = []
  for (const f of Object.keys(lesson.editorSeed ?? {})) if (!seen.includes(f)) seen.push(f)
  for (let i = 0; i <= sceneIndex && i < lesson.scenes.length; i++) {
    const s = lesson.scenes[i]
    if (isEditor(s) && !seen.includes(s.action.file)) seen.push(s.action.file)
  }
  return seen
}

/** Fully apply an editor action to the accumulated file map. */
function applyFull(files: Map<string, string>, a: EditorAction): void {
  if (a.replace != null) files.set(a.file, a.replace)
  else if (a.type != null) files.set(a.file, (files.get(a.file) ?? '') + a.type)
}

/**
 * Derive what the editor shows at a given scene + intra-scene progress (0..1).
 *
 * Editor files start empty and are built up by each scene's `type`/`replace`.
 * The current scene's typing is revealed proportionally to `progress`, giving
 * the char-by-char effect. Diagnostics appear once typing for the scene is done.
 * Returns null when no editor file is in view yet.
 */
export function computeEditorView(
  lesson: Lesson,
  sceneIndex: number,
  progress: number,
): EditorView | null {
  // Start from any pre-existing (seeded) code so a part can begin with code
  // from a prior series part, then build on top of it.
  const files = new Map<string, string>(Object.entries(lesson.editorSeed ?? {}))

  // Fold every editor scene strictly before the current one.
  for (let i = 0; i < sceneIndex && i < lesson.scenes.length; i++) {
    const s = lesson.scenes[i]
    if (isEditor(s)) applyFull(files, s.action)
  }

  const current = lesson.scenes[sceneIndex]
  let viewFile: string | undefined
  let callouts: Callout[] = NO_CALLOUTS
  let diagnostics: Diagnostic[] = NO_DIAGS
  let reveal: [number, number] | undefined
  let typing = false

  if (current && isEditor(current)) {
    const a = current.action
    viewFile = a.file
    const base = files.get(a.file) ?? ''
    const incoming = a.replace != null ? a.replace : a.type ?? ''
    const animated = a.typed !== false && (a.type != null || a.replace != null)
    // Type faster than the scene: finish the keystrokes within the first ~62% of
    // the scene, leaving the rest to read while the narration explains it.
    const typed = Math.min(1, progress / TYPE_WINDOW)

    if (a.replace != null) {
      // Replace: type the whole new content from scratch.
      const shown = animated ? incoming.slice(0, Math.floor(typed * incoming.length)) : incoming
      files.set(a.file, shown)
      typing = animated && shown.length < incoming.length
    } else if (a.type != null) {
      const add = animated ? incoming.slice(0, Math.floor(typed * incoming.length)) : incoming
      files.set(a.file, base + add)
      typing = animated && add.length < incoming.length
    }

    callouts = a.callouts ?? NO_CALLOUTS
    reveal = a.reveal
    // Diagnostics land after the code is typed, so the "error appears" beat reads.
    if (!typing && a.diagnostics) diagnostics = a.diagnostics
  } else {
    // Non-editor scene: keep showing the most recent editor file.
    for (let i = sceneIndex; i >= 0; i--) {
      const s = lesson.scenes[i]
      if (isEditor(s)) {
        viewFile = s.action.file
        break
      }
    }
  }

  // Nothing edited yet but code was seeded → show the default/first seeded file.
  if (!viewFile) {
    viewFile = lesson.editorDefaultFile ?? Object.keys(lesson.editorSeed ?? {})[0]
  }
  if (!viewFile) return null
  return {
    file: viewFile,
    content: files.get(viewFile) ?? '',
    callouts,
    diagnostics,
    reveal,
    typing,
  }
}
