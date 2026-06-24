import type { DiagramNode } from '../lesson/types'

// The diagram is drawn in a fixed coordinate system and scaled to fit the stage
// via the SVG viewBox. Node positions are given in 0–100 percentages. Ported
// from the orly / almostnode learn engine geometry.
export const VIEW_W = 1000
export const VIEW_H = 600
export const NODE_W = 170
export const NODE_H = 66
export const VIEWBOX = `-100 -40 ${VIEW_W + 200} ${VIEW_H + 80}`

export interface Pt {
  x: number
  y: number
}

export function nodeCenter(n: DiagramNode): Pt {
  return { x: ((n.x ?? 0) / 100) * VIEW_W, y: ((n.y ?? 0) / 100) * VIEW_H }
}

function borderPoint(center: Pt, target: Pt, halfW: number, halfH: number): Pt {
  const dx = target.x - center.x
  const dy = target.y - center.y
  if (dx === 0 && dy === 0) return center
  const sx = dx !== 0 ? halfW / Math.abs(dx) : Infinity
  const sy = dy !== 0 ? halfH / Math.abs(dy) : Infinity
  const t = Math.min(sx, sy)
  return { x: center.x + dx * t, y: center.y + dy * t }
}

export function connector(a: DiagramNode, b: DiagramNode, gap = 7) {
  const ca = nodeCenter(a)
  const cb = nodeCenter(b)
  const start = borderPoint(ca, cb, NODE_W / 2 + gap, NODE_H / 2 + gap)
  const end = borderPoint(cb, ca, NODE_W / 2 + gap, NODE_H / 2 + gap)
  return { start, end }
}

// Assign simple column positions to any nodes missing x/y, so an author can omit
// coordinates. Reveal order → left-to-right columns, alternating rows.
export function ensurePositions(nodes: DiagramNode[]): DiagramNode[] {
  const missing = nodes.some((n) => n.x == null || n.y == null)
  if (!missing) return nodes
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
  return nodes.map((n, i) => {
    if (n.x != null && n.y != null) return n
    const col = i % cols
    const row = Math.floor(i / cols)
    const rows = Math.ceil(nodes.length / cols)
    return {
      ...n,
      x: cols === 1 ? 50 : 12 + (col * 76) / (cols - 1),
      y: rows === 1 ? 50 : 15 + (row * 70) / (rows - 1),
    }
  })
}
