import { useEffect, useRef, useState } from 'react'
import type { DatabaseAction } from '../lesson/types'

// Load PGlite's raw ESM build from jsDelivr at runtime. (Bundling it via Vite
// trips on a dead-branch `import('stream/promises')`; esm.sh wraps it in Node
// shims that break wasm loading. The raw jsDelivr file resolves its wasm
// relative to the CDN and never executes the Node-only branch in a browser.)
interface PGliteInstance {
  waitReady: Promise<void>
  exec(sql: string): Promise<unknown>
  query<T>(sql: string): Promise<{ rows: T[]; fields?: { name: string }[] }>
  close?(): Promise<void>
}
type PGliteCtor = new () => PGliteInstance
let pglitePromise: Promise<PGliteCtor> | null = null
function loadPGlite(): Promise<PGliteCtor> {
  if (!pglitePromise) {
    pglitePromise = import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.2.17/dist/index.js').then(
      (m: { PGlite: PGliteCtor }) => m.PGlite,
    )
  }
  return pglitePromise
}

export interface DbPaneProps {
  /** Schema SQL applied once before any query (workspace.dbSchema). */
  schema?: string
  action?: DatabaseAction | null
  actionNonce?: number
}

type Result = { sql: string; cols: string[]; rows: Record<string, unknown>[]; highlight?: string }

// Real in-browser Postgres (PGlite). Runs the scene's SQL and renders the rows —
// "show the query run, and the result in the database".
export function DbPane({ schema, action, actionNonce }: DbPaneProps) {
  const dbRef = useRef<PGliteInstance | null>(null)
  const [ready, setReady] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let db: PGliteInstance | null = null
    loadPGlite()
      .then(async (PGlite) => {
        db = new PGlite()
        await db.waitReady
        if (schema) await db.exec(schema)
        if (cancelled) return
        dbRef.current = db
        setReady(true)
      })
      .catch((e) => !cancelled && setError(String(e?.message ?? e)))
    return () => {
      cancelled = true
      dbRef.current = null
      void db?.close?.()
    }
  }, [schema])

  useEffect(() => {
    const db = dbRef.current
    if (!db || !ready || !action?.query) return
    db.query<Record<string, unknown>>(action.query)
      .then((res) => {
        const cols = res.fields?.map((f) => f.name) ?? Object.keys(res.rows[0] ?? {})
        setResult({ sql: action.query, cols, rows: res.rows, highlight: action.highlight })
        setError('')
      })
      .catch((e) => setError(String(e?.message ?? e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, actionNonce, ready])

  return (
    <div style={{ height: '100%', width: '100%', background: '#0b1220', color: '#e2e8f0', display: 'flex', flexDirection: 'column', font: '13px ui-monospace, monospace' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
        <span style={{ color: '#fbbf24' }}>postgres</span> · PGlite (in-browser)
        {!ready && <span style={{ marginLeft: 8 }}>· starting…</span>}
      </div>
      {result && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', whiteSpace: 'pre-wrap', color: '#7dd3fc' }}>
          {result.sql}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14 }}>
        {error && <div style={{ color: '#f87171', whiteSpace: 'pre-wrap' }}>{error}</div>}
        {result && !error && (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {result.cols.map((c) => (
                  <th key={c} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid #334155', color: c === result.highlight ? '#fbbf24' : '#cbd5e1', position: 'sticky', top: 0, background: '#0b1220' }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i}>
                  {result.cols.map((c) => (
                    <td key={c} style={{ padding: '6px 10px', borderBottom: '1px solid #1e293b', color: c === result.highlight ? '#fde68a' : '#e2e8f0', background: c === result.highlight ? 'rgba(251,191,36,0.08)' : undefined }}>
                      {fmt(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
              {result.rows.length === 0 && (
                <tr><td colSpan={result.cols.length || 1} style={{ padding: '10px', color: '#64748b' }}>(0 rows)</td></tr>
              )}
            </tbody>
          </table>
        )}
        {!result && !error && <div style={{ color: '#64748b' }}>run a query to see rows…</div>}
      </div>
    </div>
  )
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
