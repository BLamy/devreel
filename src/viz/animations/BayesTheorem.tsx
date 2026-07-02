import React from 'react'
import { Scene, type SceneCtx } from '../core/Scene'
import type { VizDefinition } from '../core/definition'
import { phase, type Act, type Sample } from '../core/timeline'
import { font, ink, palette } from '../core/theme'
import { caption, clamp01, lerp, mathLabel, type G } from '../core/draw'

// The medical-test classic, as areas. 10,000 people; 1% sick. A test with 90%
// sensitivity and a 9% false-positive rate. You test positive — what are the
// odds you're sick? The areas do the arithmetic: 90 true positives drown in
// 891 false ones. P(sick | +) = 90/981 ≈ 9.2%.

const POP = 10000
const PRIOR = 0.01
const SENS = 0.9
const FPR = 0.09
const SICK = POP * PRIOR // 100
const TRUE_POS = SICK * SENS // 90
const HEALTHY = POP - SICK // 9900
const FALSE_POS = HEALTHY * FPR // 891
const POSTERIOR = TRUE_POS / (TRUE_POS + FALSE_POS) // 0.0917…

const ACTS: Act[] = [
  {
    name: 'a population',
    duration: 2600,
    hold: 300,
    say: 'Ten thousand people. One percent of them — just one hundred — carry the disease.',
  },
  {
    name: 'the prior',
    duration: 3000,
    hold: 500,
    say: 'That sliver on the left is the sick one percent. It is so thin we have to magnify it thirty times just to see it. That is the prior.',
  },
  {
    name: 'the test',
    duration: 3400,
    hold: 500,
    say: 'Now everyone takes a test. It catches ninety percent of the sick. But it also false-alarms on nine percent of the healthy — and the healthy are almost everyone.',
  },
  {
    name: 'you test positive',
    duration: 3400,
    hold: 500,
    say: 'You test positive. So you live somewhere in the glowing regions: the true positives, or the false ones. Look how much bigger the false pile is.',
  },
  {
    name: 'the posterior',
    duration: 3000,
    hold: 1200,
    say: 'Bayes theorem is just this division. Ninety true positives, out of nine hundred eighty one positives in total. Nine point two percent. Even after a positive result from a ninety percent test, you are probably fine — the prior does the heavy lifting.',
  },
]

const CAPTIONS: Record<string, string> = {
  'a population': '10,000 people',
  'the prior': 'P(sick) = 1% — the thin red sliver (zoomed ×30 on the right)',
  'the test': 'sensitivity 90% · false-positive rate 9%',
  'you test positive': 'positives = 90 true + 891 false',
  'the posterior': '', // the formula label carries this act
}

function setup({ svg, defs, width, height, tl }: SceneCtx) {
  void defs
  const root = svg.append('g') as G

  // main population square
  const sq = { x: 70, y: 82, w: 390, h: 390 }
  // zoom panel for the sick sliver
  const zoom = { x: 560, y: 82, w: 120, h: 390 }

  const popRect = root
    .append('rect')
    .attr('x', sq.x)
    .attr('y', sq.y)
    .attr('width', sq.w)
    .attr('height', sq.h)
    .attr('rx', 6)
    .attr('fill', '#1a2030')
    .attr('stroke', ink.axis)

  const sliverW = sq.w * PRIOR // 3.9px — the honest width
  const sliver = root.append('rect').attr('x', sq.x).attr('y', sq.y).attr('width', sliverW).attr('height', sq.h).attr('fill', palette.red).attr('opacity', 0)

  // magnifier wedge from sliver to zoom panel
  const wedge = root
    .append('polygon')
    .attr(
      'points',
      `${sq.x + sliverW},${sq.y} ${zoom.x},${zoom.y} ${zoom.x},${zoom.y + zoom.h} ${sq.x + sliverW},${sq.y + sq.h}`,
    )
    .attr('fill', palette.red)
    .attr('opacity', 0)

  const zoomRect = root
    .append('rect')
    .attr('x', zoom.x)
    .attr('y', zoom.y)
    .attr('width', zoom.w)
    .attr('height', zoom.h)
    .attr('rx', 6)
    .attr('fill', '#2a1520')
    .attr('stroke', palette.red)
    .attr('stroke-opacity', 0.5)
    .attr('opacity', 0)

  // inside the zoom: true positives (top 90%)
  const truePos = root
    .append('rect')
    .attr('x', zoom.x)
    .attr('y', zoom.y)
    .attr('width', zoom.w)
    .attr('height', zoom.h * SENS)
    .attr('rx', 6)
    .attr('fill', palette.red)
    .attr('opacity', 0)

  // false positives: a band inside the healthy region
  const fpH = sq.h * FPR
  const falsePos = root
    .append('rect')
    .attr('x', sq.x + sliverW)
    .attr('y', sq.y)
    .attr('width', sq.w - sliverW)
    .attr('height', fpH)
    .attr('fill', palette.gold)
    .attr('opacity', 0)

  // labels
  const popLab = mathLabel(root, { x: sq.x + sq.w / 2, y: sq.y + sq.h / 2, text: '10,000 people', color: ink.secondary, size: 19, italic: false })
  const sickLab = mathLabel(root, { x: zoom.x + zoom.w / 2, y: zoom.y - 16, text: '100 sick (×30 zoom)', color: palette.red, size: 14, italic: false })
  sickLab.attr('opacity', 0)
  const tpLab = mathLabel(root, { x: zoom.x + zoom.w / 2, y: zoom.y + (zoom.h * SENS) / 2, text: '90 test +', color: '#0f131e', size: 15, italic: false })
  tpLab.attr('opacity', 0).attr('font-weight', 700 as unknown as string)
  const fpLab = mathLabel(root, { x: sq.x + sq.w / 2, y: sq.y + fpH / 2 + 5, text: '891 healthy test +', color: '#0f131e', size: 15, italic: false })
  fpLab.attr('opacity', 0).attr('font-weight', 700 as unknown as string)
  const healthyLab = mathLabel(root, { x: sq.x + sq.w / 2, y: sq.y + sq.h - 20, text: '9,900 healthy', color: ink.secondary, size: 14, italic: false })

  // the posterior bar: positives morph into one strip
  const bar = { x: 130, y: 490, w: 700, h: 18 }
  const barTrue = root.append('rect').attr('rx', 3).attr('fill', palette.red).attr('opacity', 0)
  const barFalse = root.append('rect').attr('rx', 3).attr('fill', palette.gold).attr('opacity', 0)
  const postLab = mathLabel(root, { x: width / 2, y: bar.y - 40, text: '', color: ink.primary, size: 22 })
  const postPct = mathLabel(root, { x: bar.x + bar.w * (TRUE_POS / (TRUE_POS + FALSE_POS)) + 10, y: bar.y - 12, text: '', color: palette.red, size: 15, anchor: 'start', mono: true })

  const cap = caption(root, { x: width / 2, y: height - 16, text: '', size: 15 })
  void font

  return (s: Sample) => {
    const pPop = phase(tl, s, 'a population')
    const pPrior = phase(tl, s, 'the prior')
    const pTest = phase(tl, s, 'the test')
    const pPos = phase(tl, s, 'you test positive')
    const pPost = phase(tl, s, 'the posterior')

    popRect.attr('opacity', pPop)
    popLab.attr('opacity', pPop * (1 - pTest) * 0.9)
    healthyLab.attr('opacity', clamp01(pPrior * 2) * (1 - pPos))

    sliver.attr('opacity', clamp01(pPrior * 2))
    wedge.attr('opacity', clamp01(pPrior * 2 - 0.5) * 0.14)
    zoomRect.attr('opacity', clamp01(pPrior * 2 - 0.5))
    sickLab.attr('opacity', clamp01(pPrior * 2 - 0.8))

    truePos.attr('opacity', pTest)
    tpLab.attr('opacity', clamp01(pTest * 2 - 1) * (1 - pPost))
    falsePos.attr('opacity', pTest * 0.92)
    fpLab.attr('opacity', clamp01(pTest * 2 - 1) * (1 - pPost))

    // "you test positive": dim everything that tested negative
    popRect.attr('fill-opacity', lerp(1, 0.35, pPos))
    zoomRect.attr('fill-opacity', lerp(1, 0.35, pPos))
    wedge.attr('opacity', clamp01(pPrior * 2 - 0.5) * 0.14 * (1 - pPos))

    // the posterior: positives fly into one bar
    const tpW = bar.w * (TRUE_POS / (TRUE_POS + FALSE_POS))
    const m = pPost
    barTrue
      .attr('x', lerp(zoom.x, bar.x, m))
      .attr('y', lerp(zoom.y, bar.y, m))
      .attr('width', lerp(zoom.w, tpW, m))
      .attr('height', lerp(zoom.h * SENS, bar.h, m))
      .attr('opacity', pPost > 0 ? 1 : 0)
    barFalse
      .attr('x', lerp(sq.x + sliverW, bar.x + tpW + 2, m))
      .attr('y', lerp(sq.y, bar.y, m))
      .attr('width', lerp(sq.w - sliverW, bar.w - tpW - 2, m))
      .attr('height', lerp(fpH, bar.h, m))
      .attr('opacity', pPost > 0 ? 0.92 : 0)
    // originals fade as the copies fly
    if (pPost > 0) {
      truePos.attr('opacity', 1 - m)
      falsePos.attr('opacity', (1 - m) * 0.92)
    }
    postLab
      .text(`P(sick | +) = 90 / (90 + 891) = ${(POSTERIOR * 100).toFixed(1)}%`)
      .attr('opacity', clamp01(pPost * 2 - 0.8))
    postPct.text('← the red is all that means "actually sick"').attr('opacity', clamp01(pPost * 2 - 1))

    const text = CAPTIONS[s.name] ?? ''
    cap.text(text).attr('opacity', text ? clamp01(s.t * 3) : 0)
  }
}

export const definition: VizDefinition = {
  id: 'bayes-theorem',
  title: "Bayes' theorem — why a positive test doesn't mean you're sick",
  summary: 'The medical-test classic as areas: 90 true positives drown in 891 false ones → 9.2%.',
  acts: ACTS,
  setup,
}

export function BayesTheorem() {
  return <Scene title={definition.title} acts={definition.acts} setup={definition.setup} />
}
