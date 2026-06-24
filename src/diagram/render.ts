import * as d3 from 'd3'
import type { Badge, DiagramEdge, DiagramNode, Message } from '../lesson/types'
import { connector, NODE_H, NODE_W, nodeCenter } from './geometry'
import { KIND_COLOR, MSG_COLOR } from './colors'
import { ICONS } from './icons'

// Ported from the orly / almostnode learn D3 renderer, with the data source
// changed from Story.steps to a precomputed per-scene state.

export const VB_W = 1200
export const VB_H = 680

type AnySel = d3.Selection<any, any, any, any>

export interface DiagramState {
  visible: Set<string>
  highlight: string[]
  activeEdges: string[]
  messages: Message[]
  badges: Badge[]
}

function setup(svg: AnySel) {
  const defs = svg.append('defs')
  defs
    .append('marker')
    .attr('id', 'arrow')
    .attr('markerWidth', 9)
    .attr('markerHeight', 9)
    .attr('refX', 7)
    .attr('refY', 4.5)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M1,1 L8,4.5 L1,8 z')
    .attr('class', 'edge-arrow')

  const camera = svg.append('g').attr('class', 'camera')
  camera.append('g').attr('class', 'layer-edges')
  camera.append('g').attr('class', 'layer-nodes')
  camera.append('g').attr('class', 'layer-packets')
}

function buildNode(g: AnySel, n: DiagramNode) {
  const color = KIND_COLOR[n.kind]
  g.style('color', color)
  g.append('rect')
    .attr('class', 'node-bg')
    .attr('x', -NODE_W / 2)
    .attr('y', -NODE_H / 2)
    .attr('width', NODE_W)
    .attr('height', NODE_H)
    .attr('rx', 14)
    .attr('stroke', color)

  const ig = g.append('g').attr('class', 'ico').attr('transform', `translate(${-NODE_W / 2 + 14}, -13) scale(${26 / 24})`)
  for (const sh of ICONS[n.kind]) {
    const el = ig.append(sh.tag)
    for (const [k, v] of Object.entries(sh.attrs)) el.attr(k, v as never)
  }

  const tx = -NODE_W / 2 + 14 + 26 + 11
  if (n.sublabel) {
    g.append('text').attr('class', 'node-label').attr('x', tx).attr('y', -3).text(n.label)
    g.append('text').attr('class', 'node-sub').attr('x', tx).attr('y', 13).text(n.sublabel)
  } else {
    g.append('text').attr('class', 'node-label').attr('x', tx).attr('y', 5).text(n.label)
  }
  g.append('g').attr('class', 'badge-g').style('display', 'none')
}

function updateBadge(g: AnySel, badge: Badge | undefined) {
  const bg = g.select('.badge-g')
  if (!badge) {
    bg.style('display', 'none')
    return
  }
  bg.style('display', null).selectAll('*').remove()
  const tone = badge.tone ?? 'info'
  const text = bg.append('text').attr('class', `badge-text ${tone}`).attr('text-anchor', 'middle').attr('y', 3).text(badge.text.toUpperCase())
  const w = Math.ceil((text.node() as SVGTextElement).getBBox().width) + 16
  bg.insert('rect', 'text').attr('class', `badge-bg ${tone}`).attr('x', -w / 2).attr('y', -9).attr('width', w).attr('height', 18).attr('rx', 9)
  bg.attr('transform', `translate(${NODE_W / 2 - 8}, ${-NODE_H / 2 + 2})`)
}

function fitCamera(camera: AnySel, nodes: DiagramNode[], t: d3.Transition<any, any, any, any>, reduced: boolean) {
  let tr: string
  if (nodes.length === 0) {
    tr = `translate(${VB_W / 2 - 500}, ${VB_H / 2 - 300}) scale(1)`
  } else {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
    for (const n of nodes) {
      const c = nodeCenter(n)
      minx = Math.min(minx, c.x - NODE_W / 2)
      maxx = Math.max(maxx, c.x + NODE_W / 2)
      miny = Math.min(miny, c.y - NODE_H / 2)
      maxy = Math.max(maxy, c.y + NODE_H / 2)
    }
    const P = 120
    minx -= P; miny -= P; maxx += P; maxy += P
    const bw = maxx - minx, bh = maxy - miny
    const s = Math.max(0.8, Math.min(1.4, Math.min(VB_W / bw, VB_H / bh)))
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2
    tr = `translate(${VB_W / 2 - s * cx}, ${VB_H / 2 - s * cy}) scale(${s})`
  }
  if (reduced) camera.attr('transform', tr)
  else camera.transition(t).attr('transform', tr)
}

function firePackets(layer: AnySel, messages: Message[], byId: Map<string, DiagramNode>, visible: Set<string>) {
  layer.selectAll('*').interrupt().remove()
  for (const m of messages) {
    const a = byId.get(m.from)
    const b = byId.get(m.to)
    if (!a || !b || !visible.has(m.from) || !visible.has(m.to)) continue
    const { start, end } = connector(a, b)
    const color = MSG_COLOR[m.kind ?? 'request']
    const delay = m.delay ?? 0
    const duration = m.duration ?? 950

    const g = layer.append('g').attr('class', 'packet').style('color', color).style('opacity', 0).attr('transform', `translate(${start.x}, ${start.y})`)
    g.append('circle').attr('class', 'packet-halo').attr('r', 13).attr('fill', color)
    g.append('circle').attr('class', 'packet-core').attr('r', 5.5).attr('fill', color)
    if (m.label) g.append('text').attr('class', 'packet-label').attr('y', -17).attr('text-anchor', 'middle').text(m.label)

    g.transition('in').delay(delay).duration(150).style('opacity', 1)
    g.transition('move')
      .delay(delay)
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .attrTween('transform', () => {
        const ix = d3.interpolateNumber(start.x, end.x)
        const iy = d3.interpolateNumber(start.y, end.y)
        return (k) => `translate(${ix(k)}, ${iy(k)})`
      })
    g.transition('out').delay(delay + duration - 180).duration(200).style('opacity', 0).remove()
  }
}

export function renderDiagram(
  svgEl: SVGSVGElement,
  allNodes: DiagramNode[],
  allEdges: DiagramEdge[],
  state: DiagramState,
  reduced: boolean,
) {
  const svg = d3.select(svgEl)
  if (svg.select('g.camera').empty()) setup(svg)

  const dur = reduced ? 0 : 650
  const t = d3.transition().duration(dur).ease(d3.easeCubicInOut) as d3.Transition<any, any, any, any>

  const byId = new Map(allNodes.map((n) => [n.id, n]))
  const { visible } = state
  const nodes = allNodes.filter((n) => visible.has(n.id))
  const edges = allEdges.filter((e) => visible.has(e.from) && visible.has(e.to))

  const highlight = state.highlight
  const hasFocus = highlight.length > 0
  const nodeDim = (id: string) => (hasFocus && !highlight.includes(id) ? 0.32 : 1)

  const msgPairs = new Set(state.messages.map((m) => `${m.from}>${m.to}`))
  const edgeActive = (e: DiagramEdge) =>
    state.activeEdges.includes(e.id) || msgPairs.has(`${e.from}>${e.to}`) || msgPairs.has(`${e.to}>${e.from}`)
  const edgeOpacity = (e: DiagramEdge) => (hasFocus && !highlight.includes(e.from) && !highlight.includes(e.to) ? 0.16 : 0.95)

  const camera = svg.select('g.camera')
  fitCamera(camera, nodes, t, reduced)

  // edges
  const edgeJoin = camera.select('.layer-edges').selectAll<SVGGElement, DiagramEdge>('g.edge').data(edges, (d) => d.id)
  edgeJoin.exit().interrupt().transition(t).style('opacity', 0).remove()
  const edgeEnter = edgeJoin.enter().append('g').attr('class', 'edge').style('opacity', 0)
  edgeEnter.append('line').attr('marker-end', 'url(#arrow)')
  const edgeAll = edgeEnter.merge(edgeJoin as never)
  edgeAll.select('line').each(function (d) {
    const { start, end } = connector(byId.get(d.from)!, byId.get(d.to)!)
    d3.select(this)
      .attr('class', `edge-line${edgeActive(d) ? ' active' : ''}${d.dashed ? ' dashed' : ''}`)
      .attr('x1', start.x).attr('y1', start.y).attr('x2', end.x).attr('y2', end.y)
  })
  edgeAll.transition(t).style('opacity', (d) => edgeOpacity(d))

  // nodes
  const nodeJoin = camera.select('.layer-nodes').selectAll<SVGGElement, DiagramNode>('g.node').data(nodes, (d) => d.id)
  nodeJoin.exit().interrupt().transition(t).style('opacity', 0).remove()
  const nodeEnter = nodeJoin
    .enter()
    .append('g')
    .attr('class', 'node')
    .style('opacity', 0)
    .attr('transform', (d) => {
      const c = nodeCenter(d)
      return `translate(${c.x}, ${c.y}) scale(0.85)`
    })
  nodeEnter.each(function (d) {
    buildNode(d3.select(this), d)
  })
  const nodeAll = nodeEnter.merge(nodeJoin as never)
  nodeAll.classed('active', (d) => highlight.includes(d.id))
  nodeAll.each(function (d) {
    updateBadge(d3.select(this), state.badges.find((b) => b.node === d.id))
  })
  nodeAll
    .transition(t)
    .style('opacity', (d) => nodeDim(d.id))
    .attr('transform', (d) => {
      const c = nodeCenter(d)
      return `translate(${c.x}, ${c.y}) scale(${highlight.includes(d.id) ? 1.05 : 1})`
    })

  if (!reduced) firePackets(camera.select('.layer-packets'), state.messages, byId, visible)
}
