import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'

// Provide each language's worker by label. Setting a model's language to
// typescript/javascript activates Monaco's TS service, which asks for the TS
// "foreign module" — if only the base editor worker is provided it fails with
// FileAccess `toUrl` errors. Wiring the real workers (the canonical Vite setup)
// fixes that. We then turn OFF TS validation so the only squiggles are the
// lesson's scripted diagnostics.
let configured = false
export function setupMonaco(): typeof monaco {
  if (!configured) {
    configured = true
    ;(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
      getWorker(_workerId, label) {
        if (label === 'typescript' || label === 'javascript') return new tsWorker()
        if (label === 'json') return new jsonWorker()
        if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
        return new editorWorker()
      },
    }

    const ts = monaco.languages.typescript
    const noValidation = { noSemanticValidation: true, noSyntaxValidation: true, noSuggestionDiagnostics: true }
    ts.typescriptDefaults.setDiagnosticsOptions(noValidation)
    ts.javascriptDefaults.setDiagnosticsOptions(noValidation)
    const compiler = { jsx: ts.JsxEmit.React, allowJs: true, allowNonTsExtensions: true, target: ts.ScriptTarget.ESNext }
    ts.typescriptDefaults.setCompilerOptions(compiler)
    ts.javascriptDefaults.setCompilerOptions(compiler)
  }
  return monaco
}

export function languageForFile(path: string): string {
  if (/\.(tsx?)$/.test(path)) return 'typescript'
  if (/\.(jsx?)$/.test(path)) return 'javascript'
  if (/\.json$/.test(path)) return 'json'
  if (/\.s?css$/.test(path)) return 'css'
  if (/\.html?$/.test(path)) return 'html'
  if (/\.md$/.test(path)) return 'markdown'
  return 'plaintext'
}
