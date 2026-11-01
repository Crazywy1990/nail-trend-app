# AllTen

Trending nail looks picked for each client, with the trend evidence, the reason it suits her, the price and time, and a spec sheet her nail tech can work from.

Web first (installable PWA) at allten.app (planned), wrapped as an App Store app once retention is proven.

## Repo layout

```
apps/web        Next.js 14 (App Router, TypeScript). Discover screen, public look pages,
                tech spec sheets, booking message, seasonal themes.
services/api    FastAPI. Look catalog, set selection (MMR), profiles, event log.
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

Add `?theme=base|summer|autumn|halloween|christmas` to any URL to preview a theme (it's remembered in a cookie). Without it, the theme follows the date.

Tests: `cd services/api && python -m pytest -q` · `cd apps/web && npm run typecheck && npm run build`

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

## Data model notes

- `system` (gel, builder gel, Gel-X) and `finish` (chrome, cat-eye, french, matte, jelly, gloss, art) are separate fields. `system` is shown in the meta line; `finish` drives diversity and the Finish chips.
- `trendProof.isPlaceholder` is `true` for every look until the trend pipeline exists. The UI shows a **Sample data** tag whenever it's true.
- `shades[].code` stores the full formula-prefixed code (OPI: GC = GelColor, NL = Nail Lacquer, ISL = Infinite Shine). `shades[].verified` is `true` only for catalog-checked codes; anything unverified prints as "code to verify".

Verified: OPI GelColor Malaga Wine (GC L87), Bubble Bath (GC S86), Alpine Snow (GC L00), Funny Bunny (GC H22), Big Apple Red (GC N25). The remaining shades are generic descriptions with no product code yet.

## Next slices

1. Onboarding: this-or-that swipes, skin tone, undertone, jewelry metal, current set. Saved page.
2. Trend pipeline and image tagger; replaces seed data and clears the Sample data tags.
3. Salons: save a favorite, Places-based discovery, Square booking pilot (NYC).
4. Weekly trend pages and the salon QR flow.
