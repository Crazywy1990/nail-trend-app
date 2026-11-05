"""AllTen weekly trend pipeline (standard library only).

Measures each trend term two ways and writes the result where the web app reads it:

  1. YouTube upload volume: how many new videos matched the term in the last 28 days
     versus the 28 days before (YouTube Data API v3, search.list, pageInfo.totalResults).
     Counting new uploads, not views, avoids favoring old videos that kept collecting views.
     YouTube's counts are estimates and run low for the most recent weeks across the board,
     so each term's change is measured against the median change of all terms: its share
     of new nail videos. Counts at YouTube's 1,000,000 ceiling can't show change and are
     left out of the median. The estimates also jitter from call to call, so each term's
     ratio is averaged (geometric mean) with the previous run's, and a percentage is only
     quoted with at least 200 videos behind it.
  2. Editorial mentions: headlines in beauty-magazine RSS feeds from the last 28 days that
     contain one of the term's keywords.

Output: apps/web/lib/engine/trends.json (read by the engine at build time) and one line
appended to services/pipeline/history.jsonl per run.

Run:  YOUTUBE_API_KEY=... python services/pipeline/pipeline.py
      python services/pipeline/pipeline.py --rescore   (re-score the last run from history.jsonl, no API calls)
If the key is missing or YouTube fails, the previous trends.json is kept unchanged.
"""
from __future__ import annotations

import email.utils
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TERMS_FILE = HERE / "trend_terms.json"
OUT_FILE = ROOT / "apps" / "web" / "lib" / "engine" / "trends.json"
HISTORY_FILE = HERE / "history.jsonl"

WINDOW_DAYS = 28
RISING = 0.25    # growth at or above +25% → rising
FADING = -0.25   # growth at or below −25% → fading
MIN_VIDEOS = 200  # below this (both windows combined) the growth figure is too noisy to quote
YT_CAP = 1_000_000  # YouTube reports totalResults no higher than this
YT_SEARCH = "https://www.googleapis.com/youtube/v3/search"
UA = "AllTenTrendBot/1.0 (+https://github.com/Crazywy1990)"


def http_get(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------- YouTube
def youtube_count(query: str, after: datetime, before: datetime, key: str, get=http_get) -> int:
    """Number of US English videos uploaded in [after, before) matching query. Costs 100 quota units."""
    params = {
        "part": "id", "type": "video", "q": query, "maxResults": 1,
        "publishedAfter": iso(after), "publishedBefore": iso(before),
        "regionCode": "US", "relevanceLanguage": "en", "key": key,
    }
    body = json.loads(get(f"{YT_SEARCH}?{urllib.parse.urlencode(params)}"))
    return int(body.get("pageInfo", {}).get("totalResults", 0))


# -------------------------------------------------------------- Editorial
def parse_feed(xml: bytes) -> list[tuple[str, datetime | None]]:
    """(title, published) for every item in an RSS or Atom feed."""
    out: list[tuple[str, datetime | None]] = []
    root = ET.fromstring(xml)
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag not in ("item", "entry"):
            continue
        title, when = "", None
        for child in el:
            ctag = child.tag.rsplit("}", 1)[-1]
            text = (child.text or "").strip()
            if ctag == "title":
                title = text
            elif ctag in ("pubDate", "published", "updated") and text and when is None:
                try:
                    when = email.utils.parsedate_to_datetime(text)
                except (TypeError, ValueError):
                    try:
                        when = datetime.fromisoformat(text.replace("Z", "+00:00"))
                    except ValueError:
                        when = None
                if when and when.tzinfo is None:
                    when = when.replace(tzinfo=timezone.utc)
        if title:
            out.append((title, when))
    return out


def headline_matches(title: str, keywords: list[str]) -> bool:
    t = title.lower()
    return any(re.search(rf"\b{re.escape(k.lower())}\b", t) for k in keywords)


def editorial_counts(feeds: list[str], terms: dict, since: datetime, get=http_get) -> tuple[dict[str, int], int]:
    """Headlines per term in the window, and how many feeds were read successfully."""
    items: dict[str, datetime | None] = {}
    ok = 0
    for url in feeds:
        try:
            for title, when in parse_feed(get(url)):
                items.setdefault(title, when)
            ok += 1
        except Exception as e:  # one bad feed shouldn't stop the run
            print(f"  feed skipped: {url} ({type(e).__name__})", file=sys.stderr)
    recent = [t for t, w in items.items() if w is None or w >= since]
    counts = {tid: sum(headline_matches(t, cfg["keywords"]) for t in recent) for tid, cfg in terms.items()}
    return counts, ok


# ---------------------------------------------------------------- Scoring
def growth(recent: int, prior: int) -> float:
    return (recent - prior) / max(prior, 1)


def ratio(recent: int, prior: int) -> float:
    return (recent + 1) / (prior + 1)


def measurable(recent: int, prior: int) -> bool:
    return recent + prior >= MIN_VIDEOS and max(recent, prior) < YT_CAP


def smoothed_ratio(now: tuple[int, int], prev: tuple[int, int] | None) -> float:
    """Geometric mean of this run's ratio and the previous run's, when both are measurable."""
    r = ratio(*now)
    if prev and measurable(*prev) and measurable(*now):
        r = (r * ratio(*prev)) ** 0.5
    return r


def baseline(counts: dict[str, tuple[int, int]], prev: dict[str, tuple[int, int]] | None = None) -> float:
    """Median (smoothed) recent/prior ratio of the measurable terms (enough videos, under the cap)."""
    prev = prev or {}
    rs = sorted(smoothed_ratio(c, prev.get(t)) for t, c in counts.items() if measurable(*c))
    if not rs:
        return 1.0
    m = len(rs) // 2
    return rs[m] if len(rs) % 2 else (rs[m - 1] + rs[m]) / 2


def label_for(g: float) -> str:
    return "rising" if g >= RISING else "fading" if g <= FADING else "steady"


def velocity(g: float) -> float:
    """0..1, 0.5 = flat. +100% growth or more → 1.0; −100% → 0.0."""
    return round(max(0.0, min(1.0, 0.5 + g / 2)), 3)


def term_result(recent: int, prior: int, headlines: int, base: float = 1.0, prev: tuple[int, int] | None = None) -> dict:
    raw = growth(recent, prior)
    rel = smoothed_ratio((recent, prior), prev) / base - 1  # change in share of new nail videos
    capped = max(recent, prior) >= YT_CAP
    enough = measurable(recent, prior)
    return {
        "recent": recent, "prior": prior, "rawGrowth": round(raw, 3), "growth": round(rel, 3),
        "label": label_for(rel) if enough else "steady",
        "velocity": velocity(rel) if enough else 0.5,
        "enoughData": enough, "capped": capped, "headlines": headlines,
    }


LABEL_TEXT = {"rising": "↑ Rising", "steady": "→ Steady", "fading": "↓ Cooling"}


def proof_text(term_label: str, t: dict) -> str:
    parts: list[str] = []
    if t.get("capped"):
        parts.append(f"“{term_label}” is among the most-posted nail styles on YouTube")
    elif t["enoughData"]:
        pct = round(t["growth"] * 100)
        if abs(pct) < 5:
            parts.append(f"“{term_label}” is holding its share of new nail videos on YouTube")
        elif pct > 100:
            parts.append(f"“{term_label}” share of new nail videos on YouTube more than doubled vs the 4 weeks before")
        elif pct < -50:
            parts.append(f"“{term_label}” share of new nail videos on YouTube down by more than half vs the 4 weeks before")
        else:
            verb = "up" if pct > 0 else "down"
            parts.append(f"“{term_label}” share of new nail videos on YouTube {verb} {abs(pct)}% vs the 4 weeks before")
    else:
        parts.append(f"{t['recent']} new “{term_label}” YouTube videos in the last 4 weeks")
    if t["headlines"]:
        s = "" if t["headlines"] == 1 else "s"
        parts.append(f"{t['headlines']} beauty-magazine headline{s} this month")
    return " · ".join(parts)


def look_results(cfg: dict, term_res: dict[str, dict]) -> dict[str, dict]:
    """Each look quotes its first term; its velocity blends its terms (first term weighted 2×)."""
    out: dict[str, dict] = {}
    for look_id, tids in cfg["looks"].items():
        have = [t for t in tids if t in term_res]
        if not have:
            continue
        primary = have[0]
        weights = [2.0] + [1.0] * (len(have) - 1)
        vel = sum(w * term_res[t]["velocity"] for w, t in zip(weights, have)) / sum(weights)
        p = term_res[primary]
        out[look_id] = {
            "text": proof_text(cfg["terms"][primary]["label"], p),
            "isPlaceholder": False,
            "label": p["label"],
            "badge": LABEL_TEXT[p["label"]],
            "velocity": round(vel, 3),
            "term": primary,
            "sources": ["YouTube Data API"] + (["Beauty-magazine RSS"] if p["headlines"] else []),
        }
    return out


# -------------------------------------------------------------------- Run
def read_history(path: Path | None = None) -> list[dict]:
    path = path or HISTORY_FILE
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def counts_of(entry: dict | None) -> dict[str, tuple[int, int]]:
    return {t: (v["recent"], v["prior"]) for t, v in (entry or {}).get("terms", {}).items()}


def score(counts: dict[str, tuple[int, int]], heads: dict[str, int], cfg: dict, now: datetime,
          prev: dict[str, tuple[int, int]] | None = None, feeds_ok: int = 0) -> dict:
    start_recent = now - timedelta(days=WINDOW_DAYS)
    start_prior = start_recent - timedelta(days=WINDOW_DAYS)
    prev = prev or {}
    base = baseline(counts, prev)
    print(f"  baseline (median recent/prior ratio): {base:.3f}  smoothing with previous run: {bool(prev)}")
    term_res: dict[str, dict] = {}
    for tid, (recent, prior) in counts.items():
        term_res[tid] = term_result(recent, prior, heads.get(tid, 0), base, prev.get(tid))
        r = term_res[tid]
        print(f"  {tid:14s} {recent:>7d} vs {prior:>7d}  share {r['growth']:+.0%}  {r['label']:7s} headlines={heads.get(tid, 0)}")

    return {
        "generatedAt": iso(now),
        "window": {"days": WINDOW_DAYS, "recentFrom": iso(start_recent), "priorFrom": iso(start_prior)},
        "method": "Change in each term's share of new nail videos on YouTube, last 28 days vs the 28 before (US, English), relative to the median of all terms and averaged with the previous run; beauty-magazine RSS headline matches",
        "baseline": round(base, 4),
        "feedsRead": feeds_ok,
        "terms": term_res,
        "looks": look_results(cfg, term_res),
    }


def run(key: str, now: datetime | None = None, get=http_get, cfg: dict | None = None,
        prev: dict[str, tuple[int, int]] | None = None) -> dict:
    cfg = cfg or json.loads(TERMS_FILE.read_text())
    now = now or datetime.now(timezone.utc)
    start_recent = now - timedelta(days=WINDOW_DAYS)
    start_prior = start_recent - timedelta(days=WINDOW_DAYS)
    heads, feeds_ok = editorial_counts(cfg.get("editorialFeeds", []), cfg["terms"], start_recent, get)
    counts: dict[str, tuple[int, int]] = {}
    for tid, t in cfg["terms"].items():
        counts[tid] = (
            youtube_count(t["query"], start_recent, now, key, get),
            youtube_count(t["query"], start_prior, start_recent, key, get),
        )
    return score(counts, heads, cfg, now, prev, feeds_ok)


def write(result: dict, history: bool = True) -> None:
    OUT_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    if history:
        with HISTORY_FILE.open("a") as h:
            h.write(json.dumps({"generatedAt": result["generatedAt"], "terms": result["terms"]}, ensure_ascii=False) + "\n")
    print(f"Wrote {OUT_FILE.relative_to(ROOT)}: {len(result['looks'])} looks, {len(result['terms'])} terms.")


def rescore() -> int:
    """Re-score the latest history entry (smoothed with the one before it) without calling any API."""
    hist = read_history()
    if not hist:
        print("history.jsonl is empty; nothing to re-score.", file=sys.stderr)
        return 1
    cfg = json.loads(TERMS_FILE.read_text())
    last = hist[-1]
    prev = counts_of(hist[-2]) if len(hist) > 1 else None
    now = datetime.fromisoformat(last["generatedAt"].replace("Z", "+00:00"))
    heads = {t: v.get("headlines", 0) for t, v in last["terms"].items()}
    old = json.loads(OUT_FILE.read_text()) if OUT_FILE.exists() else {}
    write(score(counts_of(last), heads, cfg, now, prev, old.get("feedsRead", 0)), history=False)
    return 0


def main() -> int:
    if "--rescore" in sys.argv:
        return rescore()
    key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not key:
        print("YOUTUBE_API_KEY is not set; keeping the previous trends.json.", file=sys.stderr)
        return 1
    hist = read_history()
    try:
        result = run(key, prev=counts_of(hist[-1]) if hist else None)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        print(f"YouTube request failed ({e.code}): {detail}\nKeeping the previous trends.json.", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Pipeline failed ({type(e).__name__}: {e}); keeping the previous trends.json.", file=sys.stderr)
        return 1
    write(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
