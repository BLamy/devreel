import type { ReactNode } from 'react'

// Tiny inline markdown: **bold**, *italic*, `code`. Enough for scene captions.
export function renderInlineMarkdown(src: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index))
    if (m[2] != null) out.push(<strong key={key++}>{m[2]}</strong>)
    else if (m[3] != null) out.push(<em key={key++}>{m[3]}</em>)
    else if (m[4] != null)
      out.push(
        <code key={key++} style={{ background: 'rgba(148,163,184,0.25)', padding: '1px 5px', borderRadius: 4, fontSize: '0.92em' }}>
          {m[4]}
        </code>,
      )
    last = re.lastIndex
  }
  if (last < src.length) out.push(src.slice(last))
  return out
}
