---
description: Generate a new devreel "simulated video" lesson from a library/repo + topic and publish it to the feed
---

# /new-lesson — add a lesson to the devreel feed

Turn a library (GitHub repo or local path) + a topic into a narrated, puppeted
"simulated video": a real almostnode workspace driven on a voiceover-synced
timeline (editor typing, scripted errors, live preview + Eruda, terminal, DB,
architecture diagram).

**Arguments:** `$ARGUMENTS` — ideally `<repo-url-or-path> | <topic prompt> [| <short title>]`.
If missing/unclear, ask the user for the library and what to teach.

Keys come from the gitignored `.env` (`ELEVENLABS_API_KEY`). The lesson is written
by **you (Claude Code)** — no Anthropic key needed.

## Steps

1. **Pick a slug** (kebab-case, unique) and a short **title** (e.g. "TanStack Query").

2. **Digest the library** (don't hand-roll it):
   ```bash
   node -e "import('./generator/repo.mjs').then(m=>{const d=m.acquireAndDigest({repo:process.argv[1],prompt:process.argv[2]});require('fs').writeFileSync('/tmp/dl-digest.txt',d.digest);console.error('digest:',d.chosen.length,'files,',d.digest.length,'chars');})" "<REPO>" "<TOPIC PROMPT>"
   ```

3. **Write the lesson.** Read `generator/prompts/storyboard.txt` (obey every rule)
   and `src/lesson/types.ts` (the exact shape), plus `/tmp/dl-digest.txt`. Ground
   EVERYTHING in the digest (real identifiers/APIs). Author a runnable
   `workspace.files` project and a 6–14 scene timeline that TYPES real code, shows a
   real common error + fix (editor diagnostics), and ends on the live preview.
   Write it to `src/lessons/<slug>.lesson.mjs` as `export const lesson = { ... }`.

4. **Validate** until ok:true (fix every error):
   ```bash
   node -e "import('./src/lessons/<SLUG>.lesson.mjs').then(async m=>{const v=(await import('./generator/validate.mjs')).validateLesson(m.lesson);console.log(JSON.stringify(v,null,2))})"
   ```

5. **Build the lesson** (TTS + bake + register), no browser:
   ```bash
   node generator/cli.mjs --lesson src/lessons/<SLUG>.lesson.mjs
   ```
   This narrates the whole lesson once (ElevenLabs, exact per-scene cues), writes
   `public/generated/<SLUG>/{lesson.json,audio.mp3}`, and upserts the lesson into
   `public/generated/library.json`.

6. **Preview locally:** `npm run dev` → `http://localhost:5173/?lesson=<SLUG>`
   (add `&layout=vertical` for the reel layout). Confirm the typing, the error
   beat, and the live preview play in sync with the voiceover.

7. **Publish:**
   ```bash
   git add public/generated src/lessons && git commit -m "lesson: <TITLE>" && git push
   ```

## Rules
- **Ground everything in real code** — no invented components, files, APIs, or flows.
- React/react-dom need no install; any other imported npm dep MUST be in
  `workspace.install`.
- The concatenation of a file's editor `type`/`replace` ops must equal
  `workspace.files[file]` by the end.
