import { useEffect, useMemo, useRef } from 'react'
import type { DiagramAction, Lesson } from '../lesson/types'
import { ensurePositions } from '../diagram/geometry'
import { renderDiagram, VB_W, VB_H, type DiagramState } from '../diagram/render'

export interface DiagramPaneProps {
  lesson: Lesson
  sceneIndex: number
}

// Cumulative reveal/hide across all diagram scenes up to the current one; the
// current scene supplies highlight/messages/badges. If no reveals were authored,
// show every node (omitting `reveal` = "show all").
function diagramState(lesson: Lesson, sceneIndex: number): DiagramState {
  const visible = new Set<string>()
  let sawDiagram = false
  for (let i = 0; i <= sceneIndex && i < lesson.scenes.length; i++) {
    const s = lesson.scenes[i]
    if (s.action?.tool === 'diagram') {
      sawDiagram = true
      const a = s.action
      for (const r of a.reveal ?? []) visible.add(r)
      for (const h of a.hide ?? []) visible.delete(h)
    }
  }
  if (sawDiagram && visible.size === 0) {
    for (const n of lesson.diagram?.nodes ?? []) visible.add(n.id)
  }
  const cur = lesson.scenes[sceneIndex]
  const a: DiagramAction | null = cur?.action?.tool === 'diagram' ? cur.action : null
  return {
    visible,
    highlight: a?.highlight ?? [],
    activeEdges: a?.activeEdges ?? [],
    messages: a?.messages ?? [],
    badges: a?.badges ?? [],
  }
}

export function DiagramPane({ lesson, sceneIndex }: DiagramPaneProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const nodes = useMemo(() => ensurePositions(lesson.diagram?.nodes ?? []), [lesson])
  const edges = lesson.diagram?.edges ?? []

  useEffect(() => {
    if (!svgRef.current) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    renderDiagram(svgRef.current, nodes, edges, diagramState(lesson, sceneIndex), reduced)
  }, [lesson, sceneIndex, nodes, edges])

  if (!lesson.diagram) {
    return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#64748b' }}>no diagram in this lesson</div>
  }

  return (
    <div style={{ height: '100%', width: '100%', background: '#0b1220' }}>
      <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet" />
      <style>{DIAGRAM_CSS}</style>
    </div>
  )
}

const DIAGRAM_CSS = `
.node-bg { fill: #0f1f33; stroke-width: 2; }
.node.active .node-bg { fill: #15314f; stroke-width: 2.5; }
.ico { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.node-label { fill: #e2e8f0; font: 600 16px system-ui; }
.node-sub { fill: #94a3b8; font: 400 12px system-ui; }
.edge-line { stroke: #475569; stroke-width: 2; fill: none; }
.edge-line.active { stroke: #38bdf8; stroke-width: 2.6; }
.edge-line.dashed { stroke-dasharray: 6 5; }
.edge-arrow { fill: #64748b; }
.packet-halo { opacity: 0.25; }
.packet-label { fill: #e2e8f0; font: 600 12px system-ui; }
.badge-text { font: 700 10px system-ui; }
.badge-text.ok { fill: #052e1a; } .badge-bg.ok { fill: #34d399; }
.badge-text.warn { fill: #3b1106; } .badge-bg.warn { fill: #fb923c; }
.badge-text.info { fill: #04222e; } .badge-bg.info { fill: #38bdf8; }
`
