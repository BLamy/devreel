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

// A representative code snippet for the feed thumbnail: the primary editor file's
// first few non-empty lines (else the largest non-html/json workspace file).
export function posterSnippet(lesson) {
  const scenes = lesson.scenes || [];
  const files = (lesson.workspace && lesson.workspace.files) || {};
  const editorScene = scenes.find((s) => s.action && s.action.tool === 'editor' && s.action.file && files[s.action.file]);
  let file = editorScene && editorScene.action.file;
  if (!file) {
    const keys = Object.keys(files).filter((k) => !/\.html?$|\.json$/i.test(k));
    file = keys.sort((a, b) => files[b].length - files[a].length)[0] || Object.keys(files)[0] || '';
  }
  const content = (file && files[file]) || '';
  const code = content
    .split('\n')
    .filter((l) => l.trim().length)
    .slice(0, 7)
    .map((l) => (l.length > 46 ? l.slice(0, 45) + '…' : l))
    .join('\n');
  return { file: file || '', code };
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
