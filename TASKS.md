# devreel → SaaS: Task Breakdown & Priority Queue

Roadmap for turning devreel from a static, anonymous app into a SaaS:
Stripe creator tiers (Free = 3 tutorials, paid = more, staff = unlimited), a publish
page, per-video visibility (public / unlisted / private), playlists with
lowest-common-permission semantics, free unlimited viewing of public videos, and a
business product (org-private "for you" feed, GitHub/Linear/Google Workspace/Box/Dropbox
connectors, PDF upload, company knowledge search, AI insights).

**Stack decisions** (defaults — revisit if needed):

- Cloudflare-native: one Worker (Hono) serving the SPA assets *and* the API
  (`main` + `run_worker_first: ["/api/*", "/a/*"]` in `wrangler.jsonc`)
- D1 + Drizzle for relational data; R2 for lesson artifacts and uploads; Queues for
  async jobs; Vectorize for embeddings
- Stripe hosted Checkout + Customer Portal (never embedded Elements — see Risks)
- Auth: **better-auth on D1** — Workers-native, free at anonymous-viewer scale, has
  organization/SSO plugins for the B2B phase; redirect-only OAuth because the app's
  COEP/COOP isolation (required by almostnode) breaks popups and third-party widgets
- Creation is phased: authenticated publish API + CLI first, in-app AI generation later
- Watching public videos is free and unlimited, no login

## Target architecture

```
Browser SPA (React/Vite, cross-origin isolated)
   │  same-origin fetch (cookies)
   ▼
Cloudflare Worker (Hono)
 ├─ /assets, /*            → static assets (dist/, SPA fallback, COEP/COOP headers)
 ├─ /api/auth/*            → better-auth (sessions in D1)
 ├─ /api/feed, /api/lessons, /api/playlists, /api/billing, /api/orgs, /api/search
 ├─ /a/<slug>/lesson.json  → R2 read, visibility check, Cache API for public only
 ├─ /a/<slug>/audio.mp3    → R2 ranged read (streaming), visibility check
 ├─ /api/webhooks/stripe   → subscription sync
 └─ Queues producer        → generation / ingestion jobs
        │
        ▼
 D1 (relational)  R2 (artifacts, uploads)  Queues (TTS bake, ingest, insights)
 Vectorize (org embeddings)  Cron Triggers (connector sync)
 Egress: Stripe, ElevenLabs, Anthropic API, connector APIs
```

**Data model (D1):** users/auth tables (better-auth, plus `role 'user'|'staff'`),
`api_keys` (CLI publish), `lessons` (owner_id, org_id?, title, subtitle, library,
format, description, tags, `visibility 'public'|'unlisted'|'private'|'org'`,
`status 'draft'|'processing'|'published'|'failed'`, duration, scene_count, poster,
accent, series fields, r2_prefix), `playlists` + `playlist_items(position)`,
`subscriptions` (Stripe ids, tier, status, period end), `usage_counters` (quota),
`orgs`, `org_members`, `connectors` (provider, encrypted tokens, last_sync),
`documents`, `document_chunks` (vectors live in Vectorize), `generation_jobs`.

**Entitlements** are computed, not stored: tier → quota map in code
(`free: 3, pro: N, studio: M, staff: ∞`) checked against `usage_counters`.

---

## Task catalog

Sizes: S / M / L / XL. Existing-file references are the integration points.

### M0 — Backend foundation + auth

| ID | Size | Task | Deps |
|----|------|------|------|
| F1 | M | **Worker-with-assets conversion.** Hono app in `workers/api/`; `wrangler.jsonc` gains `main` + `run_worker_first`; Worker responses emit the same COEP/COOP/CORP headers as `public/_headers`. | — |
| F2 | M | **D1 + migrations.** Provision D1 (prod + preview), Drizzle schema v1 (users/auth, lessons, playlists, subscriptions, usage_counters, api_keys), migration scripts in `workers/api/db/`. | F1 |
| F3 | L | **better-auth integration.** Email+password plus GitHub/Google redirect OAuth, D1 adapter, Hono session middleware, React client (`useSession`), sign-in/up UI in `src/auth/`. | F2 |
| F4 | M | **R2 artifact service + migration.** `/a/<slug>/lesson.json\|audio.mp3` handlers (Range streaming, Cache API for public objects only); one-shot script migrating `public/generated/*` into R2 with D1 rows seeded from `library.json`; redirects from old `/generated/*` paths. | F1, F2 |
| F5 | M | **SPA shell + routing.** react-router: `/` feed, `/watch/:slug` (keep `?lesson=` redirect shim), `/publish`, `/dashboard`, `/pricing`, `/settings`; auth-aware nav. Touches `src/App.tsx`, new `src/pages/`. | F3 |
| F6 | S | **CI/CD + environments.** `deploy.yml`/`preview.yml` run migrations, deploy the Worker, manage secrets (Stripe, ElevenLabs, Anthropic, auth); preview env gets its own D1/R2. | F1, F2 |

### M1 — Ownership, publish, visibility

| ID | Size | Task | Deps |
|----|------|------|------|
| P1 | M | **Lesson model + read APIs.** `GET /api/feed` (published + public, cursor-paginated) and `GET /api/lessons/:slug` (public → anyone; unlisted → link only, excluded from feed; private → owner). Extend `src/lesson/types.ts` with `description`, `tags`; shared `packages/lesson-core` for types + validation. | F2, F3, F4 |
| P2 | L | **Publish API.** `POST /api/lessons` multipart (lesson.json + audio.mp3); server-side re-validation (port `generator/validate.mjs` and poster/accent logic from `generator/library.mjs` into lesson-core); writes R2 + D1; update/delete endpoints. | P1 |
| P3 | M | **CLI publish.** `generator/cli.mjs` keeps local bake for preview (`--local`) but replaces the `public/generated` write + `upsertLesson` with an authenticated `POST /api/lessons` using an API key; update `.claude/commands/new-lesson.md`. | P2 |
| P4 | M | **Publish page.** `/publish`: upload baked artifact pair, title/description/tags/visibility form, quota indicator. | P2, F5 |
| P5 | M | **Feed + watch cutover.** `src/feed/Feed.tsx` fetches `/api/feed`; `src/runtime/LessonLoader.tsx` fetches `/api/lessons/:slug` with credentials and audio from `/a/*`; graceful 401/403 ("this video is private") states. | P1, F4 |
| P6 | M | **Creator dashboard v1.** `/dashboard`: my lessons, visibility toggle, metadata edit, delete (removes R2 objects). | P2, F5 |

### M2 — Billing + quotas

| ID | Size | Task | Deps |
|----|------|------|------|
| B1 | M | **Stripe products + Checkout/Portal.** Define tiers in Stripe; `POST /api/billing/checkout` (hosted redirect) and `/api/billing/portal`. | F3 |
| B2 | M | **Webhooks + entitlements.** `/api/webhooks/stripe` (signature-verified) syncs `subscriptions`; `getEntitlements(user)` resolves tier/staff. | B1, F2 |
| B3 | S | **Quota enforcement + staff role.** Publish API checks entitlement vs `usage_counters` (402-style response drives upgrade prompt); `role='staff'` bypass + small admin endpoint to grant it. | B2, P2 |
| B4 | S | **Pricing page + upgrade UX.** `/pricing`, quota meter in dashboard/publish page. | B1, F5 |

### M3 — Playlists + creator polish

| ID | Size | Task | Deps |
|----|------|------|------|
| L1 | M | **Playlist model + API.** CRUD + reorder. Effective visibility computed at read: `min(playlist.visibility, min(items.visibility))` with ordering public > unlisted > private; only own or public lessons addable. Write the edge-case decision table first (member flips private, unlisted leakage, item 403s). | P1 |
| L2 | M | **Playlist UI + watch flow.** Dashboard playlist manager; `/playlist/:id` watch page with autoplay-next. Migrate `series`/`seriesOrder` into playlists (supersedes `groupItems()` in `Feed.tsx` and `SeriesInfo` in `LessonLoader.tsx`; keep fields for back-compat). | L1, P5 |
| L3 | M | **View counts + creator profile.** View beacon endpoint + counter; public `/u/:handle` page. | P5 |

### M4 — In-app AI generation

| ID | Size | Task | Deps |
|----|------|------|------|
| G1 | M | **Jobs + Queues.** `generation_jobs` table, Cloudflare Queue + consumer skeleton with retries/DLQ, `GET /api/jobs/:id` polling. | F2, F6 |
| G2 | L | **Server-side TTS bake.** Port `generator/tts.mjs`/`speech.mjs` + cue alignment to the queue consumer via ElevenLabs REST (with-timestamps); write mp3 + baked lesson.json to R2; lesson status processing → published. | G1, P2 |
| G3 | XL | **Storyboard LLM service.** Reproduce the local `/new-lesson` Claude Code loop server-side: GitHub-API/tarball repo digest (rewrite `generator/repo.mjs` — Workers can't shell out to git), Anthropic API + `generator/prompts/storyboard.txt`, bounded validate-and-retry via `validateLesson`. Needs its own prompt-eval harness. | G2 |
| G4 | M | **Creation wizard.** `/create`: topic/library/format form, live job progress, draft preview player, publish button; quota consumed at generation start. | G3, B3 |

### M5 — Orgs/teams

| ID | Size | Task | Deps |
|----|------|------|------|
| O1 | M | **Org model + invites.** better-auth organization plugin (orgs, members, invitations), org switcher in nav. | F3 |
| O2 | M | **Org visibility + private feed.** `lessons.org_id` + `visibility='org'`; `/api/feed?org=` for members; `/org/:slug` feed page — the company "for you" page. | O1, P5 |
| O3 | L | **Org billing + admin.** Seat-based Business tier (Stripe quantity), org admin page (members, roles, billing, org quota). | O1, B2 |
| O4 | S | **Org publish targeting.** Publish page/CLI can target an org; org playlists. | O2, L1 |

### M6 — Connectors + knowledge search

| ID | Size | Task | Deps |
|----|------|------|------|
| C1 | L | **Connector framework.** OAuth redirect flows, AES-GCM token encryption, Cron Trigger → Queue sync scheduler, incremental-sync contract (`content_hash`). | O1, G1 |
| C2 | L | **GitHub connector.** App installation; READMEs/docs/PR + issue titles/bodies with timestamps → `documents`. | C1 |
| C3 | M | **Linear connector.** Issues/projects/cycles → `documents`. | C1 |
| C4 | L | **Google Workspace connector.** Drive/Docs export-as-text ingestion. | C1 |
| C5 | M | **Box + Dropbox connectors.** File listing + text extraction. | C1 |
| C6 | M | **PDF upload + parse.** Upload to R2, parse in a queue consumer (Workers AI toMarkdown / unpdf) → `documents`. | G1, O1 |
| C7 | L | **Chunk + embed pipeline.** Chunk documents, embed (Workers AI; external API fallback), upsert Vectorize with `{org_id, document_id}` metadata; delete/re-embed on change. | any of C2–C6 |
| C8 | M | **Search API + UI.** Org-scoped semantic search (Vectorize filtered by org_id, chunks hydrated from D1) + search page in the org feed. | C7 |

### M7 — AI insights + generated org lessons

| ID | Size | Task | Deps |
|----|------|------|------|
| I1 | XL | **Insight jobs.** Scheduled/on-demand retrieval-grounded LLM syntheses: "state of the project", "what to do next", "what customers are saying", "what's taking too long" (uses C2/C3 timestamps); every claim cites source documents. | C7, C8 |
| I2 | L | **Generated org lessons.** Feed I1 outputs into the G3 storyboard pipeline to bake org-private videos into the org feed. | I1, G3 |
| I3 | M | **Insights UI.** Cards in the org feed with drill-in to sources. | I1 |

---

## Priority queue

Strict order (∥ = can run in parallel with the previous item):

| # | Task | Why now |
|---|------|---------|
| 1 | F1 | Everything needs a Worker to run in |
| 2 | F2 | Schema before any feature code |
| 3 | F3 | Auth gates every write path |
| 4 | F4 ∥ | Artifact serving unblocks the feed cutover; parallel with F3 |
| 5 | F6 ∥ | Get CI deploying Worker + D1 early so every task ships |
| 6 | F5 | Pages shell for all UI tasks |
| 7 | P1 | Core read model; unblocks both feed and publish |
| 8 | P5 | Cut the app over to the API — proves private delivery end-to-end early |
| 9 | P2 | The product's write path |
| 10 | P3 | Keeps the existing (only) authoring workflow working against the API |
| 11 | P4 ∥ | Human publish flow; parallel with P3/P6 |
| 12 | P6 | Creators must manage visibility |
| 13 | B1 ∥ | Billing scaffold; parallel with P4/P6 |
| 14 | B2 | Entitlements source of truth |
| 15 | B3 | Quotas are the business model; must precede launch |
| 16 | B4 | Can't sell tiers without a pricing page |

**—— MVP cut line ——** *Launchable v1: sign-in, publish with tiered quotas, staff
unlimited, public/unlisted/private visibility, free anonymous viewing.*

| # | Task | Why now |
|---|------|---------|
| 17 | L1 | Playlist semantics are subtle; model before UI |
| 18 | L2 | Replaces the series hack; visible product value |
| 19 | L3 ∥ | Creator retention; parallel with the G track |
| 20 | G1 | Job infra shared by generation and ingestion |
| 21 | G2 | Server TTS is the smaller half of in-app creation |
| 22 | G3 | The big bet — longest pole; start immediately after G2 |
| 23 | G4 | Ship the creation wizard |
| 24 | O1 | B2B foundation; O1/O2 can run parallel to G3 |
| 25 | O2 | The org "for you" feed |
| 26 | O3 | Business revenue |
| 27 | O4 | Org publishing + playlists |
| 28 | C1 | Connector spine before any provider |
| 29 | C2 | GitHub first — highest insight value per effort |
| 30 | C3 ∥ | Linear; parallel with C2 behind C1 |
| 31 | C6 ∥ | PDF upload; independent of connector OAuth |
| 32 | C4 ∥ | Google Workspace |
| 33 | C5 ∥ | Box + Dropbox |
| 34 | C7 | Embeddings pipeline |
| 35 | C8 | Company knowledge search |
| 36 | I1 | Insights engine |
| 37 | I3 | Insights UI |
| 38 | I2 | Generated org lessons — closes the loop with G3 |

**Parallel lanes post-MVP:** {L1–L3}, {G1–G4}, {O1–O4} are largely independent
tracks; C2–C6 fan out behind C1.

---

## Top 5 risks

1. **G3 — reproducing the Claude Code authoring loop server-side.** Today lesson
   quality comes from an interactive agent with local repo access. Server-side means
   one-shot API calls, tarball-based repo digests, bounded validate-and-retry, Queue
   wall-clock limits, and real LLM cost per generation. De-risked by shipping G2 first
   (upload authored lesson, server bakes TTS) so G3 failure doesn't block the milestone.
2. **COEP/COOP isolation** (required by almostnode) breaks third-party
   iframes/scripts and severs popup `window.opener`. Consequences baked in: hosted
   Stripe Checkout redirect only, redirect-only OAuth, better-auth over widget-based
   providers. Test every future embed on the isolated origin (F1 acceptance test).
3. **Private artifact delivery at the edge (F4/P5).** Auth-checked, Range-supporting
   mp3 streaming through the Worker. The trap is caching: public objects hit Cache
   API/CDN; private objects must never be cached on shared keys; responses need CORP
   headers compatible with the isolated page. Signed R2 URLs are cross-origin and
   fight COEP — hence same-origin `/a/*` streaming.
4. **Playlist lowest-common-permission semantics (L1).** Effective visibility changes
   retroactively when a member lesson flips private — compute at read (correct) rather
   than denormalize (stale). Decide up front: non-owner playlists containing your
   lesson, unlisted-in-public-playlist discoverability, "playlist visible but item
   403s" UX.
5. **Connector OAuth breadth (C1–C5).** Five providers × app review, token refresh,
   rate limits, incremental sync. Mitigate with a strict connector interface, ship
   GitHub alone first, and treat each provider as its own task with review lead time.

## Existing-file impact map

- `src/lesson/types.ts` — add `description`, `tags`; server-side record types
  (owner, visibility, status) live in `packages/lesson-core`
- `generator/cli.mjs` — bake steps stay; publish steps become an authenticated API call
- `generator/library.mjs` — `upsertLesson` retired; `colorForSlug`/`posterSnippet`
  move to lesson-core so the Worker computes them on publish
- `generator/validate.mjs`, `tts.mjs`, `speech.mjs`, `repo.mjs` — ported for the
  Worker runtime in G2/G3 (`repo.mjs` becomes GitHub-API-based)
- `src/feed/Feed.tsx` — fetch `/api/feed`; entry type gains visibility/views/owner
- `src/runtime/LessonLoader.tsx` — credentialed fetch of `/api/lessons/:slug`;
  series/next-up moves server-side; 401/403 handling
- `src/App.tsx` — query-param routing → react-router with `?lesson=` shim
- `wrangler.jsonc` — `main`, D1/R2/Queues/Vectorize bindings, `run_worker_first`
- `.github/workflows/deploy.yml`, `preview.yml` — migrations, secrets, per-env infra
- `.claude/commands/new-lesson.md` — final publish step becomes the CLI API call
- **New:** `workers/api/` (Hono app + queue consumers), `packages/lesson-core/`,
  `src/pages/`, `src/auth/`
