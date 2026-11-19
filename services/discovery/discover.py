"""Weekly look discovery: turn rising trends that the catalog doesn't cover into draft looks.

Cost-conscious by design:
  - Only drafts when a rising style (from this week's trends.json, with enough data) appears
    in fewer than MIN_LOOKS looks, and wasn't drafted in the last COOLDOWN_DAYS.
  - At most MAX_DRAFTS drafts per run; no gaps → no API calls → $0.
  - One small text-model call per draft (~$0.01) + one preview photo (~$0.20).
Drafts are added to the catalog on a branch and proposed as a pull request. Merging it is
the approval; the "Fill missing photos" job then adds the light and deep versions.

Run: OPENAI_API_KEY=... python services/discovery/discover.py [--dry-run]
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "photos"))
import generate as g  # noqa: E402
import verify as v  # noqa: E402

PHOTO_ATTEMPTS = 2   # first photo + at most one regeneration if the reviewer fails it

ROOT = g.ROOT
WEB_LOOKS = ROOT / "apps/web/lib/engine/looks.json"
SEED_LOOKS = ROOT / "services/api/app/seed/looks.json"
TRENDS = ROOT / "apps/web/lib/engine/trends.json"
TERMS = ROOT / "services/pipeline/trend_terms.json"
STATE = Path(__file__).resolve().parent / "state.json"
THEMES = ROOT / "apps/web/lib/engine/themes.json"
MIN_THEME_LOOKS = 6     # a holiday the feed leans into should have at least this many looks
MIN_RUNWAY_DAYS = 14    # don't draft for a theme that ends within two weeks
PUBLIC = ROOT / "apps/web/public/looks"

MAX_DRAFTS = int(os.environ.get("MAX_DRAFTS", "3"))
REDNOTE_DRAFTS = int(os.environ.get("REDNOTE_DRAFTS", "1"))   # RedNote-inspired drafts per week
REDNOTE = ROOT / "apps/web/lib/engine/rednote.json"
MIN_LOOKS = 2
COOLDOWN_DAYS = 28
TEXT_MODELS = [m for m in [os.environ.get("OPENAI_TEXT_MODEL"), "gpt-5-mini", "gpt-5.4-mini", "gpt-4.1-mini"] if m]

FINISHES = ["chrome", "cat-eye", "french", "matte", "jelly", "gloss", "art"]
COLORS = ["red", "green", "pink", "brown", "nude", "white", "blue", "multi"]
SHAPES = ["Almond", "Oval", "Round", "Square", "Squoval", "Coffin"]
OCCASIONS = ["work", "date night", "wedding", "vacation", "holiday party", "party"]
SYSTEMS = ["gel", "builder gel", "Gel-X"]


# ------------------------------------------------------------------ gaps
def find_gaps(trends: dict, terms_cfg: dict, state: dict, now: datetime) -> list[str]:
    """Rising terms with enough data, featured in fewer than MIN_LOOKS looks, not drafted recently."""
    count = {t: 0 for t in terms_cfg["terms"]}
    for tids in terms_cfg["looks"].values():
        for t in tids:
            count[t] = count.get(t, 0) + 1
    recent = {t for t, d in state.get("drafted", {}).items()
              if now - datetime.fromisoformat(d) < timedelta(days=COOLDOWN_DAYS)}
    gaps = [(t, r["growth"]) for t, r in trends.get("terms", {}).items()
            if r.get("label") == "rising" and r.get("enoughData") and count.get(t, 0) < MIN_LOOKS and t not in recent]
    return [t for t, _ in sorted(gaps, key=lambda x: -x[1])][:MAX_DRAFTS]


def theme_dates(t: dict, now: datetime) -> tuple[datetime, datetime]:
    """Next (or current) occurrence of a theme's [start, end] window."""
    def at(md: str, year: int) -> datetime:
        m, d = map(int, md.split("-"))
        return datetime(year, m, d, tzinfo=timezone.utc)
    for year in (now.year - 1, now.year, now.year + 1):
        start = at(t["window"][0], year)
        end = at(t["window"][1], year if t["window"][1] >= t["window"][0] else year + 1)
        if end + timedelta(days=1) > now:
            return start, end
    raise ValueError("unreachable")


def theme_count(themes: dict, tid: str, looks: list[dict]) -> int:
    return sum(1 for l in looks if l["colorFamily"] in themes[tid]["colors"])


def find_theme_gaps(themes: dict, looks: list[dict], state: dict, now: datetime) -> list[str]:
    """Upcoming or current themes (within their lead time, with runway left) that have too few looks."""
    out = []
    for tid, t in themes.items():
        start, end = theme_dates(t, now)
        if not (start - timedelta(days=t["leadDays"]) <= now <= end - timedelta(days=MIN_RUNWAY_DAYS)):
            continue
        last = state.get("drafted", {}).get(f"theme:{tid}")
        if last and now - datetime.fromisoformat(last) < timedelta(days=COOLDOWN_DAYS):
            continue
        if theme_count(themes, tid, looks) < MIN_THEME_LOOKS:
            out.append((start, tid))
    return [tid for _, tid in sorted(out)]


# ------------------------------------------------------------------ LLM
SYSTEM = (
    "You design nail looks for AllTen, an app for women aged 22-34 whose style is polished and neutral-leaning: "
    "wearable, salon-realistic sets that look expensive, not costume. Reply with one JSON object only."
)


def draft_prompt(term_id: str, terms_cfg: dict, looks: list[dict], trends: dict) -> str:
    t = terms_cfg["terms"][term_id]
    catalog = "\n".join(f"- {l['name']} ({l['technique']}; {l['finish']}, {l['colorFamily']})" for l in looks)
    rising = ", ".join(terms_cfg["terms"][k]["label"] for k, v in trends["terms"].items() if v.get("label") == "rising")
    return f"""The style "{t['label']}" is rising this month ({round(trends['terms'][term_id]['growth'] * 100)}% more share of new nail videos).
Other rising styles: {rising}.
Current catalog (do not duplicate any of these):
{catalog}

Design ONE new look built around "{t['label']}" that a nail tech can do in a standard salon appointment.
Return JSON with exactly these keys:
  name: short display name, "Main Idea · Detail" style like the catalog
  technique: one line a nail tech understands
  system: one of {SYSTEMS}
  finish: one of {FINISHES}
  colorFamily: one of {COLORS}
  shape: one of {SHAPES}
  length: one of ["short","medium","long"]
  priceRange: like "~$70"
  durationMin: integer minutes
  stretchLevel: integer 1-5 (1 = very safe, 5 = bold)
  occasions: 1-3 of {OCCASIONS}
  shades: list of 1-3 objects {{"brand": string or null, "name": string}} — use real product names only if you are sure they exist; otherwise brand null and a plain description
  photoBrief: one line: nails, jewelry, props and fabric for an editorial hand photo
  terms: list of 1-3 trend term ids from {list(terms_cfg['terms'])}, with "{term_id}" first
"""


def theme_prompt(theme_id: str, themes: dict, terms_cfg: dict, looks: list[dict], trends: dict) -> str:
    t = themes[theme_id]
    catalog = "\n".join(f"- {l['name']} ({l['technique']}; {l['finish']}, {l['colorFamily']})" for l in looks)
    rising = ", ".join(terms_cfg["terms"][k]["label"] for k, v in trends["terms"].items() if v.get("label") == "rising")
    return f"""{t['label']} is coming up and the catalog has too few looks for it. Theme direction: {t['brief']}.
Its palette is color families {t['colors']} and finishes {t['finishes']}. Styles rising right now: {rising} — lean on one if it fits.
Current catalog (do not duplicate any of these):
{catalog}

Design ONE new {t['label']} look in that palette that a nail tech can do in a standard salon appointment, festive but still wearable.
Return JSON with exactly these keys:
  name, technique, system (one of {SYSTEMS}), finish (one of {t['finishes']}), colorFamily (one of {t['colors']}),
  shape (one of {SHAPES}), length (short/medium/long), priceRange (like "~$70"), durationMin (integer),
  stretchLevel (integer 1-5), occasions (1-3 of {OCCASIONS}),
  shades (1-3 objects {{"brand": string or null, "name": string}}; real product names only if you are sure they exist),
  photoBrief (one line: nails, jewelry, props and fabric for an editorial hand photo),
  terms (1-3 trend term ids from {list(terms_cfg['terms'])}, the closest match first)
"""


def rednote_prompt(insp: dict, terms_cfg: dict, looks: list[dict]) -> str:
    catalog = "\n".join(f"- {l['name']} ({l['technique']}; {l['finish']}, {l['colorFamily']})" for l in looks)
    return f"""One of the most-saved nail designs on RedNote this week ({insp['saves']} saves) looks like this:
"{insp['design']}"
Turn it into an ORIGINAL AllTen look inspired by it: keep the core idea (palette, finish, technique) so it reads as the
same trend, but do not reproduce any distinctive hand-painted motif, character or logo exactly; simplify so a nail
tech can do it in a standard salon appointment. Do not duplicate any catalog look:
{catalog}

Return JSON with exactly these keys:
  name, technique, system (one of {SYSTEMS}), finish (one of {FINISHES}), colorFamily (one of {COLORS}),
  shape (one of {SHAPES}), length (short/medium/long), priceRange (like "~$70"), durationMin (integer),
  stretchLevel (integer 1-5), occasions (1-3 of {OCCASIONS}),
  shades (1-3 objects {{"brand": string or null, "name": string}}; real product names only if you are sure they exist),
  photoBrief (one line: nails, jewelry, props and fabric for an editorial hand photo),
  terms (1-3 trend term ids from {list(terms_cfg['terms'])}, "{insp['term'] if not str(insp['term']).startswith('theme:') else ''}" first if it applies)
"""


def find_rednote(state: dict, now: datetime) -> list[dict]:
    """This week's RedNote inspirations not already drafted in the last COOLDOWN_DAYS."""
    if not REDNOTE.exists():
        return []
    data = json.loads(REDNOTE.read_text())
    if now - datetime.fromisoformat(data["generatedAt"].replace("Z", "+00:00")) > timedelta(days=8):
        return []  # stale: the RedNote run didn't happen this week
    out = []
    for i in data.get("inspirations", []):
        last = state.get("drafted", {}).get(f"rednote:{i['term']}")
        if last and now - datetime.fromisoformat(last) < timedelta(days=COOLDOWN_DAYS):
            continue
        out.append(i)
    return out[:REDNOTE_DRAFTS]


def call_llm(prompt: str, key: str) -> dict:
    last = None
    for model in TEXT_MODELS:
        body = json.dumps({"model": model, "response_format": {"type": "json_object"},
                           "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]}).encode()
        req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body, method="POST",
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            out = json.loads(g.http(req, timeout=180))
            print(f"  drafted with {model}")
            return json.loads(out["choices"][0]["message"]["content"])
        except RuntimeError as e:
            last = e
            if "model" in str(e).lower() or "404" in str(e):
                continue
            raise
    raise RuntimeError(f"no text model worked: {last}")


# ------------------------------------------------------------------ validate
def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("·", " ")).strip("-")[:60]


def pick(v, allowed, default):
    return v if v in allowed else default


def _clip(text: str, n: int) -> str:
    """Shorten at a sentence or word boundary, never mid-word (the old hard cut left text like 'with a crisp')."""
    if len(text) <= n:
        return text
    cut = text[:n]
    end = max(cut.rfind(". "), cut.rfind("; "))
    return (cut[:end + 1] if end > n * 0.5 else cut[:cut.rfind(" ")].rstrip(",;:") + "…").strip()


def _drop() -> tuple[str, str]:
    """The drop new looks join: the current one in drops.json."""
    p = ROOT / "apps/web/lib/engine/drops.json"
    if p.exists():
        d = json.loads(p.read_text())
        return d["current"], d["drops"][d["current"]]["date"]
    today = datetime.now(timezone.utc).date()
    return f"{today:%G-w%V}", today.isoformat()


def to_look(d: dict, term_id: str, terms_cfg: dict, existing_ids: set[str]) -> tuple[dict, list[str]]:
    name = str(d.get("name") or terms_cfg["terms"][term_id]["label"].title()).strip()[:60]
    lid = slug(name)
    while lid in existing_ids:
        lid += "-2"
    terms = [t for t in d.get("terms", []) if t in terms_cfg["terms"]]
    terms = [term_id] + [t for t in terms if t != term_id][:2]
    look = {
        "id": lid,
        "name": name,
        "technique": _clip(str(d.get("technique", "")).strip(), 400),
        "system": pick(d.get("system"), SYSTEMS, "gel"),
        "finish": pick(d.get("finish"), FINISHES, "gloss"),
        "colorFamily": pick(d.get("colorFamily"), COLORS, "nude"),
        "shape": pick(d.get("shape"), SHAPES, "Almond"),
        "length": pick(d.get("length"), ["short", "medium", "long"], "short"),
        "priceRange": str(d.get("priceRange") or "~$70")[:12],
        "durationMin": max(30, min(150, int(d.get("durationMin") or 75))),
        "stretchLevel": max(1, min(5, int(d.get("stretchLevel") or 3))),
        "fitPrior": 0.75,  # neutral prior for a new look; feedback moves it
        "trendVelocity": 0.75,
        "photoBrief": _clip(str(d.get("photoBrief", "")).strip(), 400),
        "occasions": [o for o in d.get("occasions", []) if o in OCCASIONS][:3] or ["date night"],
        "trendSources": [],
        "trendProof": {"text": None, "isPlaceholder": True},
        # product codes are never invented: every shade starts unverified with no code
        "shades": [{"brand": (s.get("brand") or None), "name": str(s.get("name", ""))[:60], "code": None, "verified": False}
                   for s in (d.get("shades") or [])[:3] if s.get("name")],
        "photoBySkinTone": {"light": None, "medium": None, "deep": None},
        "photoPos": "center",
        "photoAlt": None,
        "why": None,
        "whyInputs": {},
        "draft": {"from": term_id, "created": datetime.now(timezone.utc).date().isoformat()},
        # weekly drop + booking hooks (apps/web/lib/engine/drops.json, techs.json)
        "dropId": _drop()[0], "dropDate": _drop()[1], "active": True,
        "bookableBy": [], "resultPhoto": None, "photoSource": "generated",
        "trendSource": None, "trendAsOf": None,
    }
    look["photoAlt"] = f"{name}: {look['technique'].lower()} on a warm-toned hand"
    return look, terms


SNAKE = {"colorFamily": "color_family", "priceRange": "price_range", "durationMin": "duration_min",
         "stretchLevel": "stretch_level", "fitPrior": "fit_prior", "trendVelocity": "trend_velocity",
         "photoBrief": "photo_brief", "trendSources": "trend_sources", "trendProof": "trend_proof",
         "photoBySkinTone": "photo_by_skin_tone", "photoPos": "photo_pos", "photoAlt": "photo_alt",
         "whyInputs": "why_inputs"}


def to_seed(look: dict) -> dict:
    s = {SNAKE.get(k, k): v for k, v in look.items() if k != "draft"}
    for k, v in {"dropId": "drop_id", "dropDate": "drop_date", "bookableBy": "bookable_by", "resultPhoto": "result_photo",
                 "photoSource": "photo_source", "trendSource": "trend_source", "trendAsOf": "trend_as_of"}.items():
        if k in s:
            s[v] = s.pop(k)
    s["trend_proof"] = {"text": look["trendProof"]["text"], "is_placeholder": look["trendProof"]["isPlaceholder"]}
    return s


def draft_key(kind: str, item) -> str:
    return f"theme:{item}" if kind == "theme" else f"rednote:{item['term']}" if kind == "rednote" else item


# ------------------------------------------------------------------ run
def main() -> int:
    dry = "--dry-run" in sys.argv
    now = datetime.now(timezone.utc)
    trends = json.loads(TRENDS.read_text())
    terms_cfg = json.loads(TERMS.read_text())
    looks = json.loads(WEB_LOOKS.read_text())
    state = json.loads(STATE.read_text()) if STATE.exists() else {"drafted": {}}
    themes = json.loads(THEMES.read_text())["themes"] if THEMES.exists() else {}

    theme_gaps = find_theme_gaps(themes, looks, state, now)
    gaps = find_gaps(trends, terms_cfg, state, now)
    rednote = find_rednote(state, now)
    print(f"Upcoming themes needing looks: {theme_gaps or 'none'}")
    print(f"RedNote inspirations: {[i['term'] for i in rednote] or 'none'}")
    print(f"Rising styles needing looks: {gaps or 'none'}")
    # seasonal gaps first (deadline), then one RedNote design, then trend gaps; MAX_DRAFTS in total
    jobs = ([("theme", t) for t in theme_gaps[:1]] + [("rednote", i) for i in rednote]
            + [("trend", t) for t in gaps])[:MAX_DRAFTS]
    if not jobs or dry:
        return 0
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        print("OPENAI_API_KEY is not set.", file=sys.stderr); return 1

    g.PER_MODEL = 1
    made = []
    reviews: dict[str, tuple[dict, int]] = {}
    ids = {l["id"] for l in looks}
    for kind, item in jobs:
        try:
            if kind == "theme":
                raw_draft = call_llm(theme_prompt(item, themes, terms_cfg, looks, trends), key)
                cand = [t for t in raw_draft.get("terms", []) if t in terms_cfg["terms"]]
                term = cand[0] if cand else next(iter(terms_cfg["terms"]))
            elif kind == "rednote":
                raw_draft = call_llm(rednote_prompt(item, terms_cfg, looks), key)
                cand = [t for t in raw_draft.get("terms", []) if t in terms_cfg["terms"]]
                term = item["term"] if item["term"] in terms_cfg["terms"] else (cand[0] if cand else next(iter(terms_cfg["terms"])))
            else:
                term = item
                raw_draft = call_llm(draft_prompt(term, terms_cfg, looks, trends), key)
            look, terms = to_look(raw_draft, term, terms_cfg, ids)
            if kind == "theme":
                look["draft"] = {"from": f"theme:{item}", "created": look["draft"]["created"]}
                look["colorFamily"] = look["colorFamily"] if look["colorFamily"] in themes[item]["colors"] else themes[item]["colors"][0]
                look["occasions"] = look["occasions"]
            if kind == "rednote":
                look["draft"] = {"from": f"rednote:{item['term']}", "created": look["draft"]["created"],
                                 "saves": item["saves"], "keyword": item["keyword"], "sourceUrl": item.get("sourceUrl")}
                # shown on the site: the platform is deliberately not named
                look["trendProof"] = {"text": "Inspired by one of the most-saved nail designs on social media this week",
                                      "isPlaceholder": False}
                look["trendSource"] = f"Social media · saves on top posts · week of {now:%b %-d}"
                look["trendAsOf"] = now.date().isoformat()
            # photo → independent AI review → one regeneration with the reviewer's fix if it fails
            fix, review, attempts = "", None, 0
            while attempts < PHOTO_ATTEMPTS:
                attempts += 1
                prompt = g.prompt_for(look) + (f" Correction from review: {fix}" if fix else "")
                raw = g.openai(prompt, key, g.OPENAI_MODEL)[0]
                review = v.verify_look(look, raw, looks, key)
                print(f"  review {look['id']} attempt {attempts}: {review['verdict']} {review.get('scores')}")
                if review.get("near_duplicate") or review["verdict"] != "fail":
                    break
                fix = review.get("photo_fix") or "; ".join(review.get("issues", [])[:3])
            if review.get("near_duplicate"):
                print(f"  DROP {look['id']}: near-duplicate of {review.get('duplicate_of')}")
                state["drafted"][draft_key(kind, item)] = now.isoformat()
                continue
        except RuntimeError as e:
            print(f"  FAIL {draft_key(kind, item)}: {e}", file=sys.stderr)
            continue
        reviews[look["id"]] = (review, attempts)
        from watermark import save_photo  # same folder as generate.py
        save_photo(raw, f"{look['id']}.jpg")
        look["photoBySkinTone"]["medium"] = f"/looks/{look['id']}.jpg"
        looks.append(look); ids.add(look["id"])
        terms_cfg["looks"][look["id"]] = terms
        state["drafted"][draft_key(kind, item)] = now.isoformat()
        made.append(look)
        print(f"  ok   {draft_key(kind, item)} → {look['id']} ({look['name']})")

    if not made:
        STATE.write_text(json.dumps(state, indent=2) + "\n")
        return 1
    WEB_LOOKS.write_text(json.dumps(looks, indent=2, ensure_ascii=False) + "\n")
    TERMS.write_text(json.dumps(terms_cfg, indent=2, ensure_ascii=False) + "\n")
    STATE.write_text(json.dumps(state, indent=2) + "\n")
    if SEED_LOOKS.exists():
        seed = json.loads(SEED_LOOKS.read_text()) + [to_seed(l) for l in made]
        SEED_LOOKS.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n")

    # pull-request body for the workflow
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    branch = os.environ.get("DRAFT_BRANCH", "")
    lines = ["New looks drafted from this week's rising trends and upcoming holidays. Each was checked by a separate AI "
             "reviewer (photo matches the spec, natural hand, realistic spec, not a duplicate) before reaching you. "
             "**Merge to approve** (they go live and get light/deep photos); close to reject. Edit "
             "`apps/web/lib/engine/looks.json` on this branch to tweak a draft before merging.", ""]
    for l in made:
        src = l["draft"]["from"]
        if src.startswith("rednote:"):
            why = (f"One of the most-saved “{l['draft']['keyword']}” posts on RedNote this week ({l['draft']['saves']:,} saves). "
                   f"Compare with the [source post]({l['draft'].get('sourceUrl')}) before merging: ours should share the trend, not copy the art.")
        elif src.startswith("theme:"):
            tid = src.split(":", 1)[1]
            start, _ = theme_dates(themes[tid], now)
            why = (f"{themes[tid]['label']} starts {start:%b %-d} and only {theme_count(themes, tid, looks) - 1} looks "
                   f"fit its palette (target {MIN_THEME_LOOKS})")
        else:
            r = trends["terms"][src]
            why = (f"“{terms_cfg['terms'][src]['label']}” share of new nail videos up "
                   f"{round(r['growth'] * 100)}% vs the 4 weeks before")
        img = f"https://github.com/{repo}/blob/{branch}/apps/web/public/looks/{l['id']}.jpg?raw=true"
        shades = "; ".join((f"{s['brand']} " if s["brand"] else "") + s["name"] for s in l["shades"]) or "—"
        lines += [f"### {l['name']}", f"<img src=\"{img}\" width=\"480\">", "",
                  f"- **Why now:** {why}",
                  v.report_md(l, *reviews[l["id"]]),
                  f"- **Technique:** {l['technique']}",
                  f"- {l['shape']} · {l['length']} · {l['system']} · {l['finish']} · {l['priceRange']} · {l['durationMin']} min · stretch {l['stretchLevel']}/5",
                  f"- **Shades (codes to verify):** {shades}",
                  f"- **Occasions:** {', '.join(l['occasions'])}", ""]
    (ROOT / "pr-body.md").write_text("\n".join(lines))
    (ROOT / "pr-title.txt").write_text(f"New looks to review: {', '.join(l['name'] for l in made)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
