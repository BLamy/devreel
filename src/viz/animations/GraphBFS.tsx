import React from 'react'
import * as d3 from 'd3'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { ink, palette, surface } from '../core/theme'
import { caption, clamp01, glowFilter, mathLabel, type G } from '../core/draw'

// BFS as a flood: a wavefront expands level by level from the source, every
// node stamped with its distance the moment the wave reaches it — and the
// shortest path to any node is already sitting in the parent pointers.

const NODES: [number, number][] = [
  [110, 270], // 0 source
  [235, 145], [240, 390],
  [365, 85], [370, 265], [372, 445],
  [515, 150], [518, 330], [522, 462],
  [665, 95], [668, 260], [672, 420],
  [800, 175], [808, 352], // 13 target
]
const EDGES: [number, number][] = [
  [0, 1], [0, 2],
  [1, 3], [1, 4], [2, 4], [2, 5], [1, 2],
  [3, 4], [3, 6], [4, 6], [4, 7], [5, 7], [5, 8],
  [6, 9], [6, 10], [7, 10], [7, 11], [8, 11], [7, 8],
  [9, 10], [9, 12], [10, 12], [10, 13], [11, 13],
]
const SOURCE = 0
const TARGET = 13

function bfs() {
  const adj: number[][] = NODES.map(() => [])
  EDGES.forEach(([a, b]) => {
    adj[a].push(b)
    adj[b].push(a)
  })
  const dist = new Array(NODES.length).fill(-1)
  const parent = new Array(NODES.length).fill(-1)
  dist[SOURCE] = 0
  const queue = [SOURCE]
  while (queue.length) {
    const u = queue.shift()!
    for (const v of adj[u]) {
      if (dist[v] === -1) {
        dist[v] = dist[u] + 1
        parent[v] = u
        queue.push(v)
      }
    }
  }
  const path: number[] = []
  for (let v = TARGET; v !== -1; v = parent[v]) path.unshift(v)
  return { dist, parent, path, maxDist: Math.max(...dist) }
}

const ACTS: Act[] = [
  {
    name: 'a network',
    duration: 2600,
    hold: 300,
    say: 'A network. Friends, web pages, road intersections — fourteen nodes and the links between them.',
  },
  {
    name: 'start somewhere',
    duration: 1800,
    hold: 400,
    say: 'Pick a starting node. The question: how far is everything else?',
  },
  {
    name: 'explore in waves',
    duration: 4600,
    hold: 500,
    say: 'Explore in waves. First everything one hop away. Then two. Then three. Each node is stamped with its distance the instant the wave arrives.',
  },
  {
    name: 'shortest paths for free',
    duration: 3000,
    hold: 600,
    say: 'And here is the gift: the first time the wave touches a node is provably the shortest way there. Walk the parent pointers back, and the shortest path is just… already there.',
  },
  {
    name: 'the pattern everywhere',
    duration: 2400,
    hold: 1000,
    say: 'That is breadth-first search. Web crawlers, six-degrees-of-separation, GPS preprocessing, garbage collectors — all the same wave.',
  },
]

const CAPTIONS: Record<string, string> = {
  'a network': '14 nodes, 24 edges',
  'start somewhere': 'source: how far is everything else?',
  'explore in waves': 'level k = everything exactly k hops away',
  'shortest paths for free': 'first touch = provably shortest — read the path off the parents',
  'the pattern everywhere': 'crawlers · social graphs · GPS · GC mark phase — the same wave',
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  const glow = glowFilter(defs, 'bfs-glow', 4)
  const { dist, path, maxDist } = bfs()
  const root = svg.append('g') as G

  const levelColor = d3.scaleLinear<string>().domain([0, maxDist]).range([palette.blue, palette.teal])

  // edges
  const onPath = (a: number, b: number) =>
    path.some((v, i) => i > 0 && ((path[i - 1] === a && v === b) || (path[i - 1] === b && v === a)))
  const edgeSel = EDGES.map(([a, b]) => {
    const el = root
      .append('line')
      .attr('x1', NODES[a][0])
      .attr('y1', NODES[a][1])
      .attr('x2', NODES[b][0])
      .attr('y2', NODES[b][1])
      .attr('stroke', ink.axis)
      .attr('stroke-width', 1.4)
      .attr('opacity', 0)
    return { a, b, el, isPath: onPath(a, b), level: Math.min(dist[a], dist[b]) }
  })
  // highlighted shortest-path overlay
  const pathOverlay = root
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', palette.yellow)
    .attr('stroke-width', 3.5)
    .attr('d', path.map((v, i) => (i === 0 ? 'M' : 'L') + NODES[v][0] + ',' + NODES[v][1]).join(''))

  // wavefront ring
  const wave = root
    .append('circle')
    .attr('cx', NODES[SOURCE][0])
    .attr('cy', NODES[SOURCE][1])
    .attr('fill', 'none')
    .attr('stroke', palette.blue)
    .attr('stroke-width', 1.5)

  // nodes
  const nodeSel = NODES.map(([x, y], i) => {
    const g = root.append('g') as G
    const circle = g
      .append('circle')
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', 14)
      .attr('fill', surface)
      .attr('stroke', ink.secondary)
      .attr('stroke-width', 1.5)
    const label = g
      .append('text')
      .attr('x', x)
      .attr('y', y + 5)
      .attr('text-anchor', 'middle')
      .attr('fill', ink.primary)
      .attr('font-size', 13)
      .attr('font-family', 'ui-monospace, Menlo, monospace')
      .text('')
    return { i, g, circle, label }
  })
  mathLabel(root, { x: NODES[SOURCE][0], y: NODES[SOURCE][1] + 36, text: 'source', color: palette.blue, size: 14, italic: false })
  const targetLab = mathLabel(root, {
    x: NODES[TARGET][0],
    y: NODES[TARGET][1] + 36,
    text: `${dist[TARGET]} hops — minimal`,
    color: palette.yellow,
    size: 14,
    italic: false,
  })

  const cap = caption(root, { x: width / 2, y: height - 16, text: '', size: 15 })

  return (s: Sample) => {
    const pNet = phase(tl, s, 'a network')
    const pStart = phase(tl, s, 'start somewhere')
    const pWave = phase(tl, s, 'explore in waves')
    const pPath = phase(tl, s, 'shortest paths for free')

    // frontier advances continuously through the levels
    const frontier = pWave * (maxDist + 0.35)

    for (const e of edgeSel) {
      const reached = pWave > 0 && frontier >= e.level + 1
      const dimForPath = pPath > 0 && !e.isPath ? 0.25 : 1
      e.el
        .attr('opacity', pNet * (reached ? 0.85 : 0.35) * dimForPath)
        .attr('stroke', reached ? levelColor(e.level) : ink.axis)
    }
    pathOverlay.attr('opacity', 0)
    if (pPath > 0) {
      // write the shortest path on
      const el = pathOverlay.node() as SVGPathElement & { __len?: number }
      if (el.__len == null) el.__len = el.getTotalLength()
      el.setAttribute('stroke-dasharray', String(el.__len))
      el.setAttribute('stroke-dashoffset', String((1 - pPath) * el.__len))
      pathOverlay.attr('opacity', 1).attr('filter', glow)
    }

    for (const n of nodeSel) {
      const d = dist[n.i]
      const reached = (pWave > 0 && frontier >= d) || d === 0
      const isSource = n.i === SOURCE
      const onShortest = path.includes(n.i)
      const dimForPath = pPath > 0 && !onShortest ? 0.35 : 1
      n.g.attr('opacity', pNet * dimForPath)
      n.circle
        .attr('fill', reached && pWave > 0 ? levelColor(d) : isSource && pStart > 0 ? palette.blue : surface)
        .attr('stroke', isSource && pStart > 0 ? palette.blue : reached && pWave > 0 ? levelColor(d) : ink.secondary)
        .attr('filter', isSource && pStart > 0 && pWave === 0 ? glow : null)
      n.label
        .text(reached && pWave > 0 ? String(d) : '')
        .attr('fill', '#0f131e')
        .attr('font-weight', 700)
    }

    wave
      .attr('r', pWave > 0 && pWave < 1 ? 40 + frontier * 150 : 0)
      .attr('opacity', pWave > 0 && pWave < 1 ? 0.25 * (1 - pWave) + 0.1 : 0)

    targetLab.attr('opacity', clamp01(pPath * 2 - 0.8))

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'graph-bfs',
  title: 'Breadth-first search — the wave that finds every shortest path',
  summary: 'A wavefront floods a network level by level; shortest paths fall out for free.',
  acts: ACTS,
  setup,
}

export function GraphBFS() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
