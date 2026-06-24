#!/usr/bin/env node
// devreel pipeline spine. Given an authored lesson (a .lesson.mjs module exporting
// `lesson`), narrate it once with ElevenLabs (exact per-scene cues), bake the
// runtime lesson.json + audio.mp3 under public/generated/<slug>/, and register it
// in public/generated/library.json. The lesson itself is authored by Claude Code
// (the /new-lesson command) — no Anthropic key needed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';

import { validateLesson } from './validate.mjs';
import { speechify } from './speech.mjs';
import { synthesizeLesson } from './tts.mjs';
import { upsertLesson, colorForSlug } from './library.mjs';

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const GENERATED = join(ROOT, 'public', 'generated');
const LIB_PATH = join(GENERATED, 'library.json');

// Default voice (same as orly). Override with --voice or DEVREEL_VOICE_ID.
const DEFAULT_VOICE = process.env.DEVREEL_VOICE_ID || 'Fahco4VZzobUeiPqni1S';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    }
  }
  return out;
}

async function loadLesson(p) {
  const abs = isAbsolute(p) ? p : resolve(process.cwd(), p);
  const mod = await import(pathToFileURL(abs).href);
  const lesson = mod.lesson || mod.default;
  if (!lesson) throw new Error(`${p} must export \`lesson\` (or default)`);
  return lesson;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.lesson) {
    console.error('usage: node generator/cli.mjs --lesson <path-to.lesson.mjs> [--voice <id>]');
    process.exit(2);
  }

  const lesson = await loadLesson(args.lesson);
  if (args.voice) lesson._voice = args.voice;

  // 1) Validate (+ safe repairs).
  const v = validateLesson(lesson);
  for (const w of v.warnings) console.warn('⚠️ ', w);
  if (!v.ok) {
    console.error('❌ lesson invalid:');
    for (const e of v.errors) console.error('  -', e);
    process.exit(1);
  }
  console.error(`✓ lesson valid: ${lesson.scenes.length} scenes`);

  // 2) Narrate once → exact per-scene cues.
  const spokenSegments = lesson.scenes.map((s) =>
    s.say != null ? String(s.say) : speechify(s.narration),
  );
  const voiceId = args.voice || lesson._voice || DEFAULT_VOICE;
  console.error(`🎙️  synthesizing ${spokenSegments.length} segments with ElevenLabs…`);
  const { mp3, cues, audioEnd, alignedExact } = await synthesizeLesson({ spokenSegments, voiceId });
  console.error(`   audio ${audioEnd.toFixed(1)}s, alignedExact=${alignedExact}`);

  // 3) Bake the runtime lesson + write artifacts.
  const outDir = join(GENERATED, lesson.slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'audio.mp3'), mp3);

  const runtime = { ...lesson };
  delete runtime._voice;
  runtime.audio = `/generated/${lesson.slug}/audio.mp3`;
  runtime.cueTimes = cues;
  runtime.durationSeconds = audioEnd;
  writeFileSync(join(outDir, 'lesson.json'), JSON.stringify(runtime, null, 2));

  // 4) Register in the feed.
  upsertLesson(LIB_PATH, {
    slug: lesson.slug,
    title: lesson.title,
    subtitle: lesson.subtitle || '',
    library: lesson.library,
    persona: lesson.persona || 'devreel',
    accent: lesson.accent || colorForSlug(lesson.slug),
    format: args.format || lesson.format || 'video',
    durationSeconds: Math.round(audioEnd),
    sceneCount: lesson.scenes.length,
    href: `?lesson=${lesson.slug}`,
    createdAt: args.now || new Date().toISOString(),
  });

  console.error(`✅ wrote ${outDir}/{lesson.json,audio.mp3} and updated library.json`);
  console.error(`   preview locally: npm run dev  →  http://localhost:5173/?lesson=${lesson.slug}`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
