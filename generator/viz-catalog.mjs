// Regenerate the VIZ CATALOG block inside generator/prompts/storyboard.txt
// from src/viz/manifest.mjs. Run after adding/renaming any animation or act:
//   node generator/viz-catalog.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VIZ_MANIFEST } from '../src/viz/manifest.mjs';

const PROMPT = fileURLToPath(new URL('./prompts/storyboard.txt', import.meta.url));
const BEGIN = 'VIZ CATALOG — BEGIN GENERATED';
const END = 'VIZ CATALOG — END GENERATED';

const lines = [`${BEGIN} (node generator/viz-catalog.mjs to regenerate)`];
for (const m of VIZ_MANIFEST) {
  lines.push(`  ${m.id} — ${m.summary}`);
  lines.push(`    acts: ${m.acts.join(' | ')}`);
}
lines.push(END);

let src = fs.readFileSync(PROMPT, 'utf8');
const start = src.indexOf(BEGIN);
const endIdx = src.indexOf(END);
if (start < 0 || endIdx < 0) throw new Error('catalog markers not found in storyboard.txt');
src = src.slice(0, start) + lines.join('\n') + src.slice(endIdx + END.length);
fs.writeFileSync(PROMPT, src);
console.log(`viz catalog regenerated: ${VIZ_MANIFEST.length} animations`);
