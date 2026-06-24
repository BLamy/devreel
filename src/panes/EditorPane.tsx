import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type * as Monaco from 'monaco-editor'
import { setupMonaco, languageForFile } from '../editor/monacoSetup'
import type { Callout, Diagnostic } from '../lesson/types'

const monaco = setupMonaco()
const MARKER_OWNER = 'devreel'
const NO_CALLOUTS: Callout[] = []
const NO_DIAGS: Diagnostic[] = []

type CalloutPos = { line: number; top: number; text: string; kind?: string }
const samePos = (a: CalloutPos[], b: CalloutPos[]) =>
  a.length === b.length &&
  a.every((p, i) => p.line === b[i].line && Math.abs(p.top - b[i].top) < 0.5 && p.text === b[i].text)

export interface EditorPaneProps {
  file: string
  content: string
  callouts?: Callout[]
  diagnostics?: Diagnostic[]
  reveal?: [number, number]
  /** Keep the latest typed line in view. */
  follow?: boolean
}

const severityMap: Record<string, Monaco.MarkerSeverity> = {
  error: 8, // monaco.MarkerSeverity.Error
  warning: 4,
  info: 2,
}

export function EditorPane({ file, content, callouts = NO_CALLOUTS, diagnostics = NO_DIAGS, reveal, follow = true }: EditorPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const lastContentRef = useRef<string>('')
  const calloutsRef = useRef<Callout[]>(callouts)
  calloutsRef.current = callouts
  const [calloutPos, setCalloutPos] = useState<CalloutPos[]>([])

  // Mount the editor once.
  useEffect(() => {
    if (!hostRef.current) return
    const editor = monaco.editor.create(hostRef.current, {
      value: '',
      language: languageForFile(file),
      readOnly: true,
      domReadOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      renderLineHighlight: 'none',
      theme: 'vs-dark',
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      // Read-only display: disable worker-backed features (avoids Monaco's
      // editor-worker $loadForeignModule/toUrl noise under Vite). Diagnostics are
      // scripted via setModelMarkers, not computed.
      links: false,
      hover: { enabled: false },
      codeLens: false,
      quickSuggestions: false,
      wordBasedSuggestions: 'off',
      occurrencesHighlight: 'off',
      unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
      contextmenu: false,
    })
    editorRef.current = editor
    const reposition = () => repositionCallouts()
    const d1 = editor.onDidScrollChange(reposition)
    const d2 = editor.onDidLayoutChange(reposition)
    return () => {
      d1.dispose()
      d2.dispose()
      editor.getModel()?.dispose()
      editor.dispose()
      editorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap language when the focused file changes.
  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (model) monaco.editor.setModelLanguage(model, languageForFile(file))
    lastContentRef.current = '' // force a full set on file switch
  }, [file])

  // Apply content efficiently: append-only delta when possible (typing), else set.
  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    const prev = lastContentRef.current
    if (content === prev) return

    if (content.startsWith(prev) && prev.length > 0) {
      const suffix = content.slice(prev.length)
      const end = model.getFullModelRange().getEndPosition()
      model.applyEdits([
        { range: new monaco.Range(end.lineNumber, end.column, end.lineNumber, end.column), text: suffix },
      ])
    } else {
      model.setValue(content)
    }
    lastContentRef.current = content

    if (follow) {
      const last = model.getLineCount()
      editor.revealLine(last, monaco.editor.ScrollType.Smooth)
    }
  }, [content, follow])

  // Reveal a specific range.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !reveal) return
    editor.revealLinesInCenterIfOutsideViewport(reveal[0], reveal[1], monaco.editor.ScrollType.Smooth)
  }, [reveal])

  // Scripted diagnostics → Monaco markers.
  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (!model) return
    const markers: Monaco.editor.IMarkerData[] = diagnostics.map((d) => ({
      severity: severityMap[d.severity ?? 'error'],
      message: d.message,
      startLineNumber: d.line,
      startColumn: d.column ?? 1,
      endLineNumber: d.line,
      endColumn: d.endColumn ?? model.getLineMaxColumn(Math.min(d.line, model.getLineCount())),
      source: 'lesson',
    }))
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers)
  }, [diagnostics, content])

  // Position callout chips next to their lines. Guarded so it can't loop:
  // only commit when the computed positions actually change.
  function repositionCallouts() {
    const editor = editorRef.current
    if (!editor) return
    const scrollTop = editor.getScrollTop()
    const next: CalloutPos[] = calloutsRef.current.map((c) => ({
      line: c.line,
      text: c.text,
      kind: c.kind,
      top: editor.getTopForLineNumber(c.line) - scrollTop,
    }))
    setCalloutPos((prev) => (samePos(prev, next) ? prev : next))
  }
  useLayoutEffect(repositionCallouts, [callouts, content])

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', background: '#1e1e1e' }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      {calloutPos.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            right: 12,
            top: Math.max(2, c.top),
            maxWidth: '52%',
            transform: 'translateY(-2px)',
            background: c.kind === 'warn' ? '#7c2d12' : c.kind === 'tip' ? '#14532d' : '#1e3a5f',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 12,
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          {c.text}
        </div>
      ))}
    </div>
  )
}
