// Manim-inspired palette, validated with the dataviz skill's validate_palette.js
// against the dark surface below: CVD separation PASS (worst adjacent ΔE 21.7,
// target ≥12), chroma floor PASS, contrast PASS (all 8 ≥ 3:1). The lightness-band
// check is deliberately waived: luminous strokes on near-black is the 3b1b
// aesthetic, and every foreground object carries a direct label so identity is
// never color-alone.

export const surface = '#0f131e'

export const palette = {
  blue: '#58C4DD',
  yellow: '#FFD35A',
  red: '#FC6255',
  purple: '#A874D6',
  green: '#83C167',
  pink: '#C55F73',
  teal: '#5CD0B3',
  gold: '#F0AC5F',
} as const

/** Fixed categorical order — assign by entity, never cycle. */
export const categorical = [
  palette.blue,
  palette.yellow,
  palette.red,
  palette.purple,
  palette.green,
  palette.pink,
  palette.teal,
  palette.gold,
]

export const ink = {
  primary: '#e9edf5',
  secondary: '#9aa4b8',
  muted: '#5c6478',
  faint: '#39415a',
  grid: '#1c2333',
  axis: '#39415a',
}

export const font = {
  ui: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  math: 'Georgia, "Times New Roman", STIXGeneral, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}
