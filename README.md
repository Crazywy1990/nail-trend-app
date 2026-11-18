# AllTen

Trending nail looks picked for each client, with the trend evidence, the reason it suits her, the price and time, and a spec sheet her nail tech can work from.

Web first (installable PWA) at allten.app (planned), wrapped as an App Store app once retention is proven.

## Repo layout

```
apps/web        Next.js 14 (App Router, TypeScript). Discover screen, public look pages,
                tech spec sheets, booking message, seasonal themes. Includes a built-in
                copy of the recommendation engine (lib/engine), so it runs on Vercel alone.
services/api    FastAPI. Look catalog, set selection (MMR), profiles, event log.
services/pipeline  Weekly trend pipeline (GitHub Actions). Writes apps/web/lib/engine/trends.json.
services/discovery Weekly look discovery: drafts looks for rising styles the catalog lacks, as a PR to approve.
services/photos    Photo generation (OpenAI): fills every empty look photo slot (light/medium/deep).
```

## Run locally

```bash
# API (http://127.0.0.1:8000)
cd services/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Web (http://localhost:3000), in a second terminal
cd apps/web
npm install
npm run dev
```

Environment variables are documented in `apps/web/.env.example` (web: `API_URL`, `SITE_URL`) and `services/api/.env.example` (API: `DATABASE_URL`, `WEB_ORIGINS`).

## Deploy

- **API → Vercel (second project, same repo):** Root Directory `services/api`, Framework Preset "Other". `api/index.py` + `vercel.json` route every path to FastAPI. Without `DATABASE_URL` it uses a temporary SQLite file in `/tmp`; set `DATABASE_URL` (Supabase) for persistence.
- **API → Render (alternative):** root directory `services/api`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/healthz`. `render.yaml` holds the same settings as a Blueprint.
- **Web → Vercel (all you need today):** root directory `apps/web`, no environment variables required. `/status` confirms the built-in engine is running. Set `SITE_URL` for share links. To use the Python service instead, set `USE_REMOTE_API=1` and `API_URL`.
- **Web → Vercel (remote API mode):** root directory `apps/web`. Set `API_URL` to the Render service URL (no trailing slash, no `/v1`) and `SITE_URL` to the public site URL, then redeploy.

Add `?theme=base|summer|autumn|halloween|christmas` to any URL to preview a theme (it's remembered in a cookie). Without it, the theme follows the date.

Tests: `cd services/api && python -m pytest -q` · `cd services/pipeline && python -m pytest -q` · `cd apps/web && npm run typecheck && npm run build`

## What slice 1 includes

| Area | Details |
|---|---|
| Discover | Greeting, "Describe it" input (keyword parsing), occasion/finish/length chips, "Picked for you" feed. |
| Set selection | 6 personalized-safe + 1 trending + 1 stretch. Relevance decides eligibility; MMR (λ = 0.7) with caps of 2 per color family and 3 per finish decides the set, penalizing near-duplicates of her current set. See `services/api/app/ranking.py`. |
| Feedback | Save, reject, "Too bold", book and share events update profile affinities. "Too bold" lowers her stretch ceiling. |
| Logging | Every served set is stored with picks, slots and positions; impressions carry `setId`, slot and position for later position-bias correction. Landings record `ref` and `utm_source`. |
| Public look pages | `/looks/[id]`, with Open Graph tags so shares on Pinterest, TikTok bios and iMessage show the photo. |
| Tech spec sheet | `/looks/[id]/spec`, public, no login. Unverified shade codes print as "code to verify". |
| Booking (level 2) | `/looks/[id]/book` drafts an editable message to her salon with the spec link. |
| Seasonal themes | Colors only; holiday themes start ahead of the date. |

## Weekly automation (Mondays, UTC)

| Time | Workflow | What it does | Cost |
|---|---|---|---|
| 13:02 | RedNote trends | Apify actor searches 12 Chinese nail keywords (top posts of the past week): likes + saves per term, week-over-week change, and text descriptions of the 3 most-saved designs. No RedNote images, captions or creators are stored or shown, and the site never names RedNote (cards say "social media"). | ≈ $1.50/run (secret `APIFY_TOKEN`) |
| 13:17 | Weekly trends | YouTube + magazine signals → badges and evidence on each look | free (YouTube quota) |
| 13:32 | Look discovery | Up to 3 drafts a week, each with a preview photo and an AI review, opened as one PR (merge = approve): one upcoming holiday (themes.json) with fewer than 6 looks in its palette, one RedNote-inspired original look (the PR links the source post so the approver can check it shares the trend without copying the art), then rising styles in fewer than 2 looks. The same style, theme or RedNote term is not re-proposed for 4 weeks. | $0 if nothing qualifies; ≈ $0.25 per draft |
| 13:47 + on merge | Fill missing photos | Any empty light/medium/deep slot gets a photo; light/deep are edits of the medium photo | ≈ $0.20 per photo |

Worst case ≈ $1.20/week (2 drafts approved); most weeks $0–0.40. Set a hard monthly limit in the OpenAI billing settings as a backstop. Searches never generate anything.

## Positioning: see it, book exactly it

Every look is an executable spec: photo on her hand tone, shades (verified codes styled for the tech, the rest marked approximate), technique, honest time and price, and the techs who can do exactly it.

- **Weekly drop** (`lib/engine/drops.json`): every Monday the trends job starts a new drop and picks its hero automatically: the active look with a photo whose sourced stat is rising fastest (not last week's hero if another look is rising; highest velocity if nothing is). The hero opens the home page full-bleed (tone switch, proof line with source and week, price, time, Book). Looks carry `dropId`, `dropDate`, `active`; inactive looks leave the feed but keep their pages.
- **Asked for → Got**: optional `resultPhoto` on a look renders a side-by-side pair above the description; absent → nothing.
- **Trend provenance**: pipeline stats carry `source`, `asOf` and the value as data; the site shows only sourced stats no older than 14 days (`present()` in the engine), with "YouTube · week of …". No two looks show the same stat (enforced in the pipeline and a test).
- **Booking requests** (concierge phase): `/looks/[id]/book` stores name, contact, preferred day/time and note in `booking_requests` (Neon) and confirms "Request sent — we'll confirm by message". `bookableBy` on looks + `/techs/[slug]` (one sample tech in `lib/engine/techs.json`) is the menu page for partner techs. Inbox: `/admin/requests?key=<ADMIN_KEY>` (set `ADMIN_KEY` in Vercel), with the 7-day funnel.
- **Share card**: `/looks/[id]/card` renders a 1080×1350 PNG in the site's fonts (Bricolage Grotesque, DM Sans; OFL, embedded via `lib/cardFonts.ts`) (photo with the mark, name, shades with codes, price, time). "Share to my tech" shares it as a file via the Web Share API, else the spec link, else copies the link.
- **Funnel events**: `look_view`, `save`, `share_tap`, `booking_request` (plus impressions, tone switches) go to the `events` table; `/status` shows the 7-day funnel.

## Users: profile, saved looks, salon

- **Onboarding** (`/start`, about a minute): hand tone (picked from three hand photos, never asked as race or ethnicity), jewelry metal (→ warm/cool undertone), four this-or-that picks, length, shape, adventurousness, budget. The feed then shows every look on her hand tone and ranks by her answers, picks and saves (`buildProfile` in the engine); "Subtle" caps stretch, budget gently down-ranks pricier looks.
- **Saved** (`/saved`): hearts persist; each saved look has Book and Spec-for-my-tech.
- **My salon** (`/salons`): name, booking link, Instagram, phone. The booking page then offers "Copy & open booking", "Copy & DM", "Text <salon>", and the spec link carries her hand tone.
- **Storage** (`lib/store`): Postgres when `DATABASE_URL`/`POSTGRES_URL` is set (Neon via Vercel Storage; tables `profiles`, `saved`, `events` are created automatically), otherwise an httpOnly cookie on her browser. Events always go to the log and, with a database, to the `events` table.

## AI review before a person decides

`services/photos/verify.py` asks a separate, stronger vision model to check each draft before it reaches the approver: photo matches the spec (color, finish, shape/length), natural hand, photo quality, realistic price/time, consistent spec, and not a near-duplicate of a catalog look. Scores are 1–5; the code (not the model) sets the verdict: fail at ≤ 2 or duplicate, check at 3, else pass. Discovery regenerates a failed photo once with the reviewer's fix, drops near-duplicates, and puts the review in the PR. The photo fill checks that skin-tone edits left the nails and scene unchanged, retries once, and otherwise leaves the slot empty (the site falls back to the medium photo). Workflow **Review drafts (AI)** re-runs the review on any PR. About $0.01–0.03 per check.

## Photos: originals and watermark

Clean originals live in `assets/looks/`; the site serves the same clean files from `apps/web/public/looks/`. The AllTen watermark is drawn as an overlay inside every photo container (`components/Watermark.tsx`): same corner, size (container-query units) and opacity on cards, list thumbnails, hero, detail page, onboarding and tech pages, so a crop can never clip it. Where UI covers the bottom-right (the hero's text block) the mark moves to the top-right instead of the UI moving. "AI-generated image" appears under it for generated photos (`photoSource: "generated"`). The share card bakes the same mark into its image.

## Themes

`apps/web/lib/engine/themes.json` defines Christmas, New Year's Eve, Valentine's Day, Spring, Summer, Halloween and Thanksgiving: trigger words, a palette (color families + finishes), a date window and a lead time. Typing a trigger word or tapping a theme chip filters to looks whose color is in the palette and ranks palette finishes higher. Without a search, the feed leans lightly toward the theme of today's date. The same file tells look discovery which holidays need more looks.

## Data model notes

- `system` (gel, builder gel, Gel-X) and `finish` (chrome, cat-eye, french, matte, jelly, gloss, art) are separate fields. `system` is shown in the meta line; `finish` drives diversity and the Finish chips.
- Trend data comes from `services/pipeline` (workflow `Weekly trends`, Mondays, or run it by hand from the Actions tab). For each term in `trend_terms.json` it counts new US English YouTube uploads in the last 28 days versus the 28 before and compares each term with the median of all terms (its share of new nail videos, since YouTube undercounts recent weeks across the board; counts at the 1,000,000 ceiling are excluded) (YouTube Data API, secret `YOUTUBE_API_KEY`, about 3,600 of the 10,000 daily quota units) and headlines in beauty-magazine RSS feeds. Rising ≥ +25%, Cooling ≤ −25%, otherwise Steady; under 200 videos (or at the ceiling) no percentage is quoted, each term is averaged with the previous run to damp YouTube's jittery estimates, and shown figures are capped at "more than doubled" / "down by more than half". `python services/pipeline/pipeline.py --rescore` re-scores the last run from `history.jsonl` without API calls. Each look quotes its first term; its `trendVelocity` blends all its terms.
- The engine merges `trends.json` over `looks.json` at build time. Looks without a row keep `trendProof.isPlaceholder: true`, and the UI shows a **Sample data** tag only on those. `/status` reports `trendsUpdated` and `looksWithRealTrendData`.
- `shades[].code` stores the full formula-prefixed code (OPI: GC = GelColor, NL = Nail Lacquer, ISL = Infinite Shine). `shades[].verified` is `true` only for catalog-checked codes; anything unverified prints as "code to verify".

Verified: OPI GelColor Malaga Wine (GC L87), Bubble Bath (GC S86), Alpine Snow (GC L00), Funny Bunny (GC H22), Big Apple Red (GC N25). The remaining shades are generic descriptions with no product code yet.

## Next slices

1. Onboarding: this-or-that swipes, skin tone, undertone, jewelry metal, current set. Saved page.
2. Trend pipeline and image tagger; replaces seed data and clears the Sample data tags.
3. Salons: save a favorite, Places-based discovery, Square booking pilot (NYC).
4. Weekly trend pages and the salon QR flow.
