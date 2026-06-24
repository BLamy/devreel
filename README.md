# devreel

**Tech-tutorial "simulated videos" — a real in-browser dev environment, puppeted on a voiceover-synced timeline.**

devreel teaches how to use a library by *driving a real dev environment* ([almostnode](https://www.npmjs.com/package/almostnode)) on a timeline synced to an ElevenLabs voiceover. Nothing is pre-recorded — the editor types real code, the preview runs a real app, a cursor clicks real buttons, devtools really open. The homepage is a YouTube-style grid + reels; on mobile it becomes a TikTok-style vertical swipe feed.

## How it works

A **Lesson** is a real `almostnode` workspace + a timeline of **scenes**. Each scene focuses one **tool** and carries a puppet **action** the director runs against the live workspace, paced to the narration audio.

Tools:
- **editor** — read-only Monaco; animated typing, callouts, scripted error diagnostics
- **preview** — live in-browser dev server (iframe) driven by a deterministic Playwright-style driver: cursor-animated `click` / `fill` / `type` / `hover`, plus real **Eruda devtools** (open the Network tab, click a request, show the response)
- **database** — in-browser Postgres ([PGlite](https://pglite.dev)); run SQL, render rows
- **terminal** — xterm.js + real command execution
- **diagram** — an animated architecture/data-flow view

The same voiceover drives both the horizontal (YouTube) and vertical (reel) layouts.

## Develop

```bash
npm install
npm run dev            # http://localhost:5173
```

Routes: `/` feed · `?lesson=<slug>` watch page · `?sample=basic|tools` in-memory demos · `?probe` almostnode boot probe. Add `&layout=vertical` for the reel layout.

## Author a lesson

```bash
# digest a library, write src/lessons/<slug>.lesson.mjs (the agent does this), then:
node generator/cli.mjs --lesson src/lessons/<slug>.lesson.mjs
```

This narrates the lesson once via ElevenLabs (exact per-scene cues), bakes
`public/generated/<slug>/{lesson.json,audio.mp3}`, and registers it in `library.json`.
Needs `ELEVENLABS_API_KEY` in a gitignored `.env` (see `.env.example`).

## Deploy

Cloudflare Workers static assets (`wrangler.jsonc`). `public/_headers` sets the cross-origin
isolation headers almostnode needs. CI: push to `main` deploys; PRs get a preview (gated on
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets).

```bash
npm run build && npm run cf:deploy
```
