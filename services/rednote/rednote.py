"""Weekly RedNote (Xiaohongshu) nail-trend run.

RedNote has no public API, so this uses a third-party Apify actor
(zen-studio/rednote-search-scraper, ~$0.006 per note; secret APIFY_TOKEN). It is kept small:
KEYWORDS × PER_KEYWORD notes per week (default 12 × 20 = 240 notes ≈ $1.45).

What is kept, and what is not:
  - Kept: per-keyword counts and engagement (likes + saves) for this week, week-over-week
    change, and for the few most-saved posts a TEXT description of the nail design written
    by a vision model, plus the post link for internal provenance.
  - Not kept or shown anywhere: RedNote photos, captions or creator identities. Designs
    reach the site only as original AllTen looks (our photo, our spec) through the usual
    review pull request (services/discovery).

Output: apps/web/lib/engine/rednote.json and services/rednote/history.jsonl.
Run: APIFY_TOKEN=... OPENAI_API_KEY=... python services/rednote/rednote.py
"""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "services/photos"))
import generate as g  # noqa: E402  (shared HTTP helper with retries)

OUT = ROOT / "apps/web/lib/engine/rednote.json"
HISTORY = HERE / "history.jsonl"
ACTOR = os.environ.get("REDNOTE_ACTOR", "zen-studio~rednote-search-scraper")
PER_KEYWORD = int(os.environ.get("REDNOTE_PER_KEYWORD", "20"))
INSPIRATIONS = int(os.environ.get("REDNOTE_INSPIRATIONS", "3"))
VISION_MODELS = [m for m in [os.environ.get("OPENAI_VERIFY_MODEL"), "gpt-5.5", "gpt-5.4", "gpt-4.1"] if m]

# Chinese search keyword → our trend term id (services/pipeline/trend_terms.json) or theme id
KEYWORDS = {
    "猫眼美甲": "cat-eye",
    "镜面美甲": "chrome",
    "法式美甲": "french",
    "冰透美甲": "jelly",
    "晕染美甲": "aura",
    "哑光美甲": "matte",
    "珍珠美甲": "glazed",
    "牛奶美甲": "milky",
    "酒红美甲": "burgundy",
    "焦糖美甲": "brown",
    "玳瑁美甲": "tortoiseshell",
    "圣诞美甲": "theme:christmas",
}
UA = "AllTenTrendBot/1.0"


def apify_search(keywords: list[str], token: str) -> list[dict]:
    body = json.dumps({"keywords": keywords, "maxResults": PER_KEYWORD, "sortType": "popularity_descending",
                       "timeFilter": "1w", "noteType": "image", "includeFullBody": False,
                       "topUpFromOtherSorts": False}).encode()
    url = f"https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items?{urllib.parse.urlencode({'token': token, 'timeout': 280})}"
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    return json.loads(g.http(req, timeout=320))


def engagement(n: dict) -> tuple[int, int]:
    e = n.get("engagement") or {}
    to_int = lambda v: int(float(str(v).replace(",", "").replace("万", "e4"))) if v not in (None, "") else 0
    return to_int(e.get("liked_count")), to_int(e.get("collected_count"))


def summarize(notes: list[dict], prev: dict | None) -> dict:
    terms: dict[str, dict] = {}
    for kw, tid in KEYWORDS.items():
        rows = [n for n in notes if n.get("keyword") == kw]
        likes = sum(engagement(n)[0] for n in rows)
        saves = sum(engagement(n)[1] for n in rows)
        total = likes + saves
        p = (prev or {}).get(tid, {}).get("engagement")
        change = round((total - p) / p, 3) if p else None
        terms[tid] = {"keyword": kw, "notes": len(rows), "likes": likes, "saves": saves, "engagement": total, "change": change}
    return terms


def describe_design(note: dict, key: str) -> dict | None:
    """Download the first image only to describe the nail design in words; the image is not stored."""
    imgs = note.get("images") or []
    if not imgs:
        return None
    src = imgs[0].get("url_large") or imgs[0].get("url") or imgs[0].get("original")
    try:
        raw = g.http(urllib.request.Request(src, headers={"User-Agent": UA, "Referer": "https://www.xiaohongshu.com/"}), timeout=60)
    except RuntimeError:
        return None
    prompt = ("Describe ONLY the nail design in this photo so a nail tech could recreate it as an original set: base colors, "
              "finish (chrome, cat-eye, french, matte, jelly, gloss or art), technique and any art details, nail shape and length. "
              "Ignore the person, background and any text. Return JSON: {\"design\": one paragraph, \"finish\": string, "
              "\"colorFamily\": one of red/green/pink/brown/nude/white/blue/multi, \"shape\": string, \"length\": short/medium/long, "
              "\"salonRealistic\": true if doable in a standard salon appointment, \"isNailPhoto\": true if this is clearly a manicure photo}")
    for model in VISION_MODELS:
        body = json.dumps({"model": model, "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(raw).decode()}}]}]}).encode()
        req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body, method="POST",
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            out = json.loads(g.http(req, timeout=120))
            return json.loads(out["choices"][0]["message"]["content"])
        except RuntimeError as e:
            if "model" in str(e).lower() or "404" in str(e):
                continue
            print(f"  describe failed: {e}", file=sys.stderr)
            return None
    return None


def pick_inspirations(notes: list[dict], key: str) -> list[dict]:
    ranked = sorted(notes, key=lambda n: -engagement(n)[1])  # most saved = most "I want this"
    out, seen = [], set()
    for n in ranked:
        if len(out) >= INSPIRATIONS:
            break
        tid = KEYWORDS.get(n.get("keyword", ""))
        if not tid or tid in seen:
            continue
        d = describe_design(n, key)
        if not d or not d.get("isNailPhoto") or not d.get("salonRealistic"):
            continue
        likes, saves = engagement(n)
        seen.add(tid)
        out.append({"term": tid, "keyword": n.get("keyword"), "likes": likes, "saves": saves,
                    "design": d.get("design", "")[:600], "finish": d.get("finish"), "colorFamily": d.get("colorFamily"),
                    "shape": d.get("shape"), "length": d.get("length"),
                    "sourceUrl": n.get("url")})  # provenance only; never shown on the site
    return out


def main() -> int:
    token = os.environ.get("APIFY_TOKEN", "").strip()
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not token:
        print("APIFY_TOKEN is not set; skipping the RedNote run.", file=sys.stderr)
        return 0
    prev = None
    if HISTORY.exists():
        lines = [l for l in HISTORY.read_text().splitlines() if l.strip()]
        prev = json.loads(lines[-1])["terms"] if lines else None
    try:
        notes = apify_search(list(KEYWORDS), token)
    except RuntimeError as e:
        print(f"RedNote search failed ({e}); keeping last week's data.", file=sys.stderr)
        return 1
    print(f"  {len(notes)} notes this week")
    terms = summarize(notes, prev)
    for tid, t in terms.items():
        ch = "—" if t["change"] is None else f"{t['change']:+.0%}"
        print(f"  {t['keyword']:6s} {tid:16s} notes={t['notes']:3d} likes={t['likes']:>8d} saves={t['saves']:>8d} vs last week {ch}")
    inspirations = pick_inspirations(notes, key) if key else []
    for i in inspirations:
        print(f"  inspiration [{i['term']}] saves={i['saves']}: {i['design'][:100]}…")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    OUT.write_text(json.dumps({"generatedAt": now, "source": "RedNote (via Apify), top posts of the past week",
                               "terms": terms, "inspirations": inspirations}, indent=2, ensure_ascii=False) + "\n")
    with HISTORY.open("a") as h:
        h.write(json.dumps({"generatedAt": now, "terms": terms}, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
