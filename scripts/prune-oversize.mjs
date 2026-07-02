// Remove dist/ assets over the Cloudflare Workers 25 MiB static-asset cap.
// almostnode's optional worker runtimes (runtime-worker, tailscale-connect-
// worker: prebuilt copies, vite-bundled twins, and sourcemaps) blow past it —
// and devreel runs almostnode on the main thread, so they are never fetched
// in production. Runs as the last step of `npm run build` (a vite closeBundle
// hook is too early: worker sub-builds and the public-dir copy land after it).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const MAX = 24 * 1024 * 1024;
const dist = fileURLToPath(new URL('../dist', import.meta.url));

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]
  );

if (!fs.existsSync(dist)) {
  console.error('[prune-oversize] no dist/ — run vite build first');
  process.exit(1);
}
let pruned = 0;
for (const f of walk(dist)) {
  if (!fs.existsSync(f)) continue; // removed as a sidecar map already
  const { size } = fs.statSync(f);
  if (size <= MAX) continue;
  fs.rmSync(f);
  const map = `${f}.map`;
  if (fs.existsSync(map)) fs.rmSync(map);
  pruned++;
  console.warn(`[prune-oversize] removed ${(size / 1048576).toFixed(1)} MiB: ${f.slice(dist.length + 1)}`);
}
console.log(`[prune-oversize] done — ${pruned} file(s) removed`);
