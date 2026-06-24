// Read/update the lesson registry (public/generated/library.json) the feed renders.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const PALETTE = [
  '#d6202b', '#1f6fb2', '#3a8b3a', '#e07b1a', '#6a3f9e',
  '#198a8a', '#b0277a', '#c79100', '#41607f', '#a01f3c',
];

export function colorForSlug(slug) {
  let h = 0;
  for (const c of String(slug)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function upsertLesson(libPath, lesson) {
  let lib = { lessons: [] };
  if (existsSync(libPath)) {
    try { lib = JSON.parse(readFileSync(libPath, 'utf8')); } catch { /* start fresh */ }
  }
  if (!Array.isArray(lib.lessons)) lib.lessons = [];
  const i = lib.lessons.findIndex((l) => l.slug === lesson.slug);
  if (i >= 0) lib.lessons[i] = { ...lib.lessons[i], ...lesson };
  else lib.lessons.push(lesson);
  // newest first
  lib.lessons.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  mkdirSync(dirname(libPath), { recursive: true });
  writeFileSync(libPath, JSON.stringify(lib, null, 2));
  return lib;
}
