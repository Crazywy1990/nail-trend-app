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

ROOT = g.ROOT
WEB_LOOKS = ROOT / "apps/web/lib/engine/looks.json"
SEED_LOOKS = ROOT / "services/api/app/seed/looks.json"
TRENDS = ROOT / "apps/web/lib/engine/trends.json"
TERMS = ROOT / "services/pipeline/trend_terms.json"
STATE = Path(__file__).resolve().parent / "state.json"
PUBLIC = ROOT / "apps/web/public/looks"

MAX_DRAFTS = int(os.environ.get("MAX_DRAFTS", "2"))
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
        "technique": str(d.get("technique", "")).strip()[:120],
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
        "photoBrief": str(d.get("photoBrief", "")).strip()[:200],
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
    s["trend_proof"] = {"text": look["trendProof"]["text"], "is_placeholder": look["trendProof"]["isPlaceholder"]}
    return s


# ------------------------------------------------------------------ run
def main() -> int:
    dry = "--dry-run" in sys.argv
    now = datetime.now(timezone.utc)
    trends = json.loads(TRENDS.read_text())
    terms_cfg = json.loads(TERMS.read_text())
    looks = json.loads(WEB_LOOKS.read_text())
    state = json.loads(STATE.read_text()) if STATE.exists() else {"drafted": {}}

    gaps = find_gaps(trends, terms_cfg, state, now)
    print(f"Rising styles needing looks: {gaps or 'none'}")
    if not gaps or dry:
        return 0
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        print("OPENAI_API_KEY is not set.", file=sys.stderr); return 1

    g.PER_MODEL = 1
    made = []
    ids = {l["id"] for l in looks}
    for term in gaps:
        try:
            look, terms = to_look(call_llm(draft_prompt(term, terms_cfg, looks, trends), key), term, terms_cfg, ids)
            raw = g.openai(g.prompt_for(look), key, g.OPENAI_MODEL)[0]
        except RuntimeError as e:
            print(f"  FAIL {term}: {e}", file=sys.stderr)
            continue
        from fill import save_jpeg  # same folder as generate.py
        save_jpeg(raw, PUBLIC / f"{look['id']}.jpg")
        look["photoBySkinTone"]["medium"] = f"/looks/{look['id']}.jpg"
        looks.append(look); ids.add(look["id"])
        terms_cfg["looks"][look["id"]] = terms
        state["drafted"][term] = now.isoformat()
        made.append(look)
        print(f"  ok   {term} → {look['id']} ({look['name']})")

    if not made:
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
    lines = ["New looks drafted from this week's rising trends. **Merge to approve** (they go live and get light/deep photos); "
             "close to reject. Edit `apps/web/lib/engine/looks.json` on this branch to tweak a draft before merging.", ""]
    for l in made:
        r = trends["terms"][l["draft"]["from"]]
        img = f"https://github.com/{repo}/blob/{branch}/apps/web/public/looks/{l['id']}.jpg?raw=true"
        shades = "; ".join((f"{s['brand']} " if s["brand"] else "") + s["name"] for s in l["shades"]) or "—"
        lines += [f"### {l['name']}", f"<img src=\"{img}\" width=\"480\">", "",
                  f"- **Why now:** “{terms_cfg['terms'][l['draft']['from']]['label']}” share of new nail videos up "
                  f"{round(r['growth'] * 100)}% vs the 4 weeks before",
                  f"- **Technique:** {l['technique']}",
                  f"- {l['shape']} · {l['length']} · {l['system']} · {l['finish']} · {l['priceRange']} · {l['durationMin']} min · stretch {l['stretchLevel']}/5",
                  f"- **Shades (codes to verify):** {shades}",
                  f"- **Occasions:** {', '.join(l['occasions'])}", ""]
    (ROOT / "pr-body.md").write_text("\n".join(lines))
    (ROOT / "pr-title.txt").write_text(f"New looks to review: {', '.join(l['name'] for l in made)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
