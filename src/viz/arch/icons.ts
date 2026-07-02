import { palette } from '../core/theme'
import type { ArchKind, GroupKind } from './types'
import type { G } from '../core/draw'

// Simple geometric glyphs (no brand assets) drawn in a 24×24 box centered on
// (0,0). Color comes from the kind's family so diagrams read as a system:
// clients blue · edge/network teal · compute yellow · data purple ·
// integration gold · observability/delivery pink.

export function familyColor(kind: ArchKind): string {
  switch (kind) {
    case 'browser':
    case 'mobile':
    case 'client':
    case 'iot':
      return palette.blue
    case 'cdn':
    case 'dns':
    case 'loadbalancer':
    case 'apigateway':
    case 'edge-function':
    case 'waf':
    case 'proxy':
      return palette.teal
    case 'server':
    case 'service':
    case 'container':
    case 'kubernetes':
    case 'lambda':
    case 'vm':
    case 'worker':
    case 'cron':
      return palette.yellow
    case 'database':
    case 'replica':
    case 'cache':
    case 'queue':
    case 'topic':
    case 'blob':
    case 'search':
    case 'warehouse':
    case 'vector-db':
      return palette.purple
    case 'external':
    case 'webhook':
    case 'auth':
    case 'secrets':
    case 'email':
    case 'payments':
      return palette.gold
    default:
      return palette.pink
  }
}

export function groupColor(kind: GroupKind): string {
  switch (kind) {
    case 'region':
    case 'account':
      return palette.teal
    case 'az':
    case 'subnet':
      return palette.blue
    case 'vpc':
    case 'cluster':
      return palette.purple
    case 'edge-network':
    case 'platform':
      return palette.gold
    default:
      return palette.pink
  }
}

const stroke = (g: G, color: string) =>
  g.append('path').attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.7).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')

const glyphText = (g: G, color: string, text: string, size = 15) =>
  g
    .append('text')
    .attr('x', 0)
    .attr('y', size * 0.36)
    .attr('text-anchor', 'middle')
    .attr('fill', color)
    .attr('font-size', size)
    .attr('font-family', 'ui-monospace, Menlo, monospace')
    .attr('font-weight', 700)
    .text(text)

function cylinder(g: G, color: string, accent = false) {
  stroke(g, color).attr('d', 'M-8,-7 a8,3.2 0 0 0 16,0 a8,3.2 0 0 0 -16,0 v13 a8,3.2 0 0 0 16,0 v-13')
  if (accent) stroke(g, color).attr('d', 'M-8,-0.5 a8,3.2 0 0 0 16,0')
}

/** Draw the glyph for a node kind into `g` (24×24 box centered at 0,0). */
export function drawIcon(g: G, kind: ArchKind, color: string) {
  switch (kind) {
    case 'browser':
      stroke(g, color).attr('d', 'M-10,-8 h20 v16 h-20 Z M-10,-3.5 h20')
      g.append('circle').attr('cx', -7.5).attr('cy', -5.8).attr('r', 1).attr('fill', color)
      g.append('circle').attr('cx', -4.5).attr('cy', -5.8).attr('r', 1).attr('fill', color)
      break
    case 'mobile':
      stroke(g, color).attr('d', 'M-6,-10 h12 a2,2 0 0 1 2,2 v16 a2,2 0 0 1 -2,2 h-12 a2,2 0 0 1 -2,-2 v-16 a2,2 0 0 1 2,-2 Z M-2,7.5 h4')
      break
    case 'client':
      stroke(g, color).attr('d', 'M-9,-7 h18 v11 h-18 Z M-4,8 h8 M0,4 v4')
      break
    case 'iot':
      stroke(g, color).attr('d', 'M-6,-6 h12 v12 h-12 Z M-6,-2 h-4 M-6,2 h-4 M6,-2 h4 M6,2 h4 M-2,-6 v-4 M2,-6 v-4 M-2,6 v4 M2,6 v4')
      break
    case 'cdn':
      g.append('circle').attr('cx', 0).attr('cy', 0).attr('r', 9).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.7)
      stroke(g, color).attr('d', 'M-9,0 h18 M0,-9 c-5,5 -5,13 0,18 M0,-9 c5,5 5,13 0,18')
      break
    case 'dns':
      glyphText(g, color, '@', 17)
      break
    case 'loadbalancer':
      stroke(g, color).attr('d', 'M0,-9 v6 M0,-3 L-8,4 M0,-3 L0,6 M0,-3 L8,4')
      g.append('circle').attr('cx', 0).attr('cy', -9).attr('r', 2.2).attr('fill', color)
      for (const [x, y] of [[-8, 6], [0, 8], [8, 6]] as const) g.append('circle').attr('cx', x).attr('cy', y).attr('r', 2.2).attr('fill', color)
      break
    case 'apigateway':
      stroke(g, color).attr('d', 'M-6,-8 L-10,0 L-6,8 M6,-8 L10,0 L6,8 M-2,8 L2,-8')
      break
    case 'edge-function':
      stroke(g, color).attr('d', 'M2,-9 L-5,1 h4 L-2,9 L5,-1 h-4 Z')
      break
    case 'waf':
      stroke(g, color).attr('d', 'M-9,-7 h18 M-9,-2 h18 M-9,3 h18 M-9,8 h18 M-3,-7 v5 M3,-2 v5 M-3,3 v5')
      break
    case 'proxy':
      stroke(g, color).attr('d', 'M-9,-3 h14 M2,-6 L6,-3 L2,0 M9,4 h-14 M-2,1 L-6,4 L-2,7')
      break
    case 'server':
    case 'service':
      stroke(g, color).attr('d', 'M-9,-9 h18 v7 h-18 Z M-9,2 h18 v7 h-18 Z')
      g.append('circle').attr('cx', -5.5).attr('cy', -5.5).attr('r', 1.2).attr('fill', color)
      g.append('circle').attr('cx', -5.5).attr('cy', 5.5).attr('r', 1.2).attr('fill', color)
      break
    case 'container':
      stroke(g, color).attr('d', 'M-9,-4 h18 v10 h-18 Z M-9,-4 L-5,-9 h18 l-4,5 M-5,-1 v4 M0,-1 v4 M5,-1 v4')
      break
    case 'kubernetes':
      stroke(g, color).attr('d', 'M0,-10 L8.5,-4 L6,6 h-12 L-8.5,-4 Z')
      g.append('circle').attr('cx', 0).attr('cy', -1).attr('r', 2.4).attr('fill', color)
      break
    case 'lambda':
      glyphText(g, color, 'λ', 18)
      break
    case 'vm':
      stroke(g, color).attr('d', 'M-10,-8 h20 v16 h-20 Z M-6,-4 h12 v8 h-12 Z')
      break
    case 'worker':
      g.append('circle').attr('cx', 0).attr('cy', 0).attr('r', 4).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.7)
      stroke(g, color).attr('d', 'M0,-9 v3 M0,6 v3 M-9,0 h3 M6,0 h3 M-6.4,-6.4 l2.1,2.1 M4.3,4.3 l2.1,2.1 M-6.4,6.4 l2.1,-2.1 M4.3,-4.3 l2.1,-2.1')
      break
    case 'cron':
      g.append('circle').attr('cx', 0).attr('cy', 0).attr('r', 9).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.7)
      stroke(g, color).attr('d', 'M0,-5 V0 L4,3')
      break
    case 'database':
      cylinder(g, color, true)
      break
    case 'replica':
      cylinder(g, color)
      stroke(g, color).attr('d', 'M3,2 a4,4 0 1 1 -1,5 M2,8 l0,-3 3,1')
      break
    case 'cache':
      cylinder(g, color)
      stroke(g, color).attr('d', 'M2,-4 L-2,1 h3 L-1,6 L4,0.5 h-3 Z')
      break
    case 'queue':
      stroke(g, color).attr('d', 'M-9,-5 h5 v10 h-5 Z M-2,-5 h5 v10 h-5 Z M5,-5 h5 v10 h-5 Z')
      break
    case 'topic':
      stroke(g, color).attr('d', 'M-8,0 h6 M2,-6 l6,-2 M2,0 h8 M2,6 l6,2')
      g.append('circle').attr('cx', -1).attr('cy', 0).attr('r', 3).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.7)
      break
    case 'blob':
      stroke(g, color).attr('d', 'M-8,7 h16 l2,-10 h-20 Z M-6,-3 v-3 h12 v3')
      break
    case 'search':
      g.append('circle').attr('cx', -2).attr('cy', -2).attr('r', 6).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.7)
      stroke(g, color).attr('d', 'M3,3 L9,9')
      break
    case 'warehouse':
      stroke(g, color).attr('d', 'M-9,8 v-10 L0,-8 L9,-2 v10 Z M-4,8 v-6 h8 v6')
      break
    case 'vector-db':
      cylinder(g, color)
      g.append('circle').attr('cx', -3).attr('cy', 2).attr('r', 1.2).attr('fill', color)
      g.append('circle').attr('cx', 1).attr('cy', 4.5).attr('r', 1.2).attr('fill', color)
      g.append('circle').attr('cx', 4).attr('cy', 1).attr('r', 1.2).attr('fill', color)
      break
    case 'external':
      stroke(g, color).attr('d', 'M-4,-9 a5.5,5.5 0 0 1 8,4 a4.5,4.5 0 0 1 1,9 h-13 a5,5 0 0 1 -1,-10 a5.5,5.5 0 0 1 5,-3 Z')
      break
    case 'webhook':
      stroke(g, color).attr('d', 'M0,-8 a4,4 0 0 1 4,4 c0,3 -4,4 -4,8 M0,4 a4,4 0 1 0 0.1,0')
      break
    case 'auth':
      stroke(g, color).attr('d', 'M0,-9 L8,-6 v6 c0,5 -4,8 -8,9 c-4,-1 -8,-4 -8,-9 v-6 Z M-3,0 l2.5,2.5 L4,-2')
      break
    case 'secrets':
      g.append('circle').attr('cx', -3).attr('cy', -3).attr('r', 4.5).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.7)
      stroke(g, color).attr('d', 'M0,0 L8,8 M5,5 l3,-3 M7,7 l2.5,-2.5')
      break
    case 'email':
      stroke(g, color).attr('d', 'M-9,-6 h18 v12 h-18 Z M-9,-6 L0,2 L9,-6')
      break
    case 'payments':
      stroke(g, color).attr('d', 'M-9,-6 h18 v12 h-18 Z M-9,-2 h18 M-6,4 h5')
      break
    case 'metrics':
      stroke(g, color).attr('d', 'M-8,8 v-6 M-3,8 v-12 M2,8 v-8 M7,8 v-15')
      break
    case 'logs':
      stroke(g, color).attr('d', 'M-8,-7 h16 M-8,-2.3 h16 M-8,2.3 h10 M-8,7 h13')
      break
    case 'alerts':
      stroke(g, color).attr('d', 'M0,-9 c4,0 6,3 6,7 v3 l2,3 h-16 l2,-3 v-3 c0,-4 2,-7 6,-7 Z M-2,6 a2,2 0 0 0 4,0')
      break
    case 'repo':
      g.append('circle').attr('cx', -5).attr('cy', -6).attr('r', 2.4).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.7)
      g.append('circle').attr('cx', -5).attr('cy', 6).attr('r', 2.4).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.7)
      g.append('circle').attr('cx', 6).attr('cy', -6).attr('r', 2.4).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.7)
      stroke(g, color).attr('d', 'M-5,-3.6 v7.2 M6,-3.6 c0,5 -4,4 -8,6')
      break
    case 'ci':
      stroke(g, color).attr('d', 'M-8,0 a8,8 0 0 1 14,-5 M8,0 a8,8 0 0 1 -14,5 M6,-8 v3.5 h-3.5 M-6,8 v-3.5 h3.5')
      break
    case 'artifact':
      stroke(g, color).attr('d', 'M-8,-4 L0,-9 L8,-4 v9 L0,10 L-8,5 Z M-8,-4 L0,1 L8,-4 M0,1 v9')
      break
    default:
      glyphText(g, color, (kind as string).slice(0, 2).toUpperCase(), 11)
  }
}
