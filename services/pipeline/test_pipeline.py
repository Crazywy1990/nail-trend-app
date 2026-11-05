import json
import urllib.parse
from datetime import datetime, timezone

import pipeline as p

NOW = datetime(2026, 11, 4, tzinfo=timezone.utc)

RSS = b"""<?xml version="1.0"?><rss><channel>
<item><title>Chrome Nails Are Everywhere This Fall</title><pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate></item>
<item><title>Why Burgundy Nails Rule Autumn</title><pubDate>Fri, 30 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Old chrome nails story</title><pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate></item>
<item><title>Chromebook review</title><pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate></item>
</channel></rss>"""

ATOM = b"""<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>The cat-eye nails trend explained</title><published>2026-10-20T08:00:00Z</published></entry>
</feed>"""

CFG = {
    "terms": {
        "chrome": {"label": "chrome nails", "query": "chrome nails", "keywords": ["chrome nails"]},
        "burgundy": {"label": "burgundy nails", "query": "burgundy nails", "keywords": ["burgundy nails"]},
        "cat-eye": {"label": "cat eye nails", "query": "cat eye nails", "keywords": ["cat eye nails", "cat-eye nails"]},
        "tiny": {"label": "tiny nails", "query": "tiny nails", "keywords": ["tiny nails"]},
        "huge": {"label": "huge nails", "query": "huge nails", "keywords": ["huge nails"]},
    },
    "looks": {"a": ["chrome", "burgundy"], "b": ["cat-eye"], "c": ["tiny"], "d": ["missing"], "e": ["huge"]},
    "editorialFeeds": ["https://feed/rss", "https://feed/atom", "https://feed/broken"],
}

# (recent, prior) videos per query
# Every term is ~40% low in the recent window (YouTube undercounts recent weeks); chrome
# holds up best, cat eye drops hardest. Measurable ratios: chrome 0.984, burgundy 0.6, cat eye 0.3.
COUNTS = {"chrome nails": (9840, 10000), "burgundy nails": (3000, 5000), "cat eye nails": (1800, 6000),
          "tiny nails": (60, 20), "huge nails": (1_000_000, 1_000_000)}


def fake_get(url: str) -> bytes:
    if url == "https://feed/rss":
        return RSS
    if url == "https://feed/atom":
        return ATOM
    if url == "https://feed/broken":
        raise OSError("down")
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    assert q["key"] == ["k"] and q["type"] == ["video"] and q["regionCode"] == ["US"]
    recent, prior = COUNTS[q["q"][0]]
    is_recent = q["publishedBefore"][0] == p.iso(NOW)
    return json.dumps({"pageInfo": {"totalResults": recent if is_recent else prior}}).encode()


def test_growth_label_velocity():
    assert p.growth(164, 100) == 0.64 and p.label_for(0.64) == "rising"
    assert p.label_for(0.1) == "steady" and p.label_for(-0.5) == "fading"
    assert p.velocity(0.0) == 0.5 and p.velocity(5) == 1.0 and p.velocity(-3) == 0.0
    assert p.growth(10, 0) == 10.0  # no division by zero


def test_feed_parsing_and_matching():
    rss = p.parse_feed(RSS)
    assert len(rss) == 4 and rss[0][1].year == 2026
    assert p.parse_feed(ATOM)[0][0].startswith("The cat-eye")
    assert p.headline_matches("Chrome Nails Are Everywhere", ["chrome nails"])
    assert not p.headline_matches("Chromebook review", ["chrome nails"])


def test_baseline_is_median_of_measurable_terms():
    assert p.baseline({"a": (1000, 1000), "b": (500, 1000), "c": (100, 1000), "tiny": (10, 20), "cap": (10**6, 10**6)}) == p.ratio(500, 1000)
    assert p.baseline({}) == 1.0


def test_full_run_with_mocked_sources():
    out = p.run("k", now=NOW, get=fake_get, cfg=CFG)
    t = out["terms"]
    assert abs(out["baseline"] - p.ratio(3000, 5000)) < 1e-3  # median of chrome, burgundy, cat eye
    assert t["chrome"]["rawGrowth"] < 0  # fewer videos in absolute terms...
    assert t["chrome"]["label"] == "rising" and t["chrome"]["headlines"] == 1  # ...but a growing share; June story outside window
    assert t["burgundy"]["label"] == "steady" and t["burgundy"]["headlines"] == 1
    assert t["cat-eye"]["label"] == "fading" and t["cat-eye"]["headlines"] == 1  # Atom feed counted
    assert t["tiny"]["enoughData"] is False and t["tiny"]["label"] == "steady"
    assert out["feedsRead"] == 2  # broken feed skipped, run continues

    a = out["looks"]["a"]
    assert a["isPlaceholder"] is False and a["term"] == "chrome" and a["badge"] == "↑ Rising"
    assert "“chrome nails” share of new nail videos on YouTube up 64%" in a["text"]
    assert "1 beauty-magazine headline this month" in a["text"]
    assert a["velocity"] == round((2 * t["chrome"]["velocity"] + t["burgundy"]["velocity"]) / 3, 3)
    assert "down 50%" in out["looks"]["b"]["text"] and out["looks"]["b"]["badge"] == "↓ Cooling"
    assert t["huge"]["capped"] and t["huge"]["label"] == "steady"
    assert "among the most-posted" in out["looks"]["e"]["text"]
    assert out["looks"]["c"]["text"].startswith("60 new “tiny nails” YouTube videos")
    assert "d" not in out["looks"]  # look with no known terms keeps its placeholder


def test_main_keeps_previous_file_without_key(monkeypatch, tmp_path):
    out = tmp_path / "trends.json"
    out.write_text("{}")
    monkeypatch.setattr(p, "OUT_FILE", out)
    monkeypatch.delenv("YOUTUBE_API_KEY", raising=False)
    assert p.main() == 1 and out.read_text() == "{}"


def test_real_config_maps_every_catalog_look():
    cfg = json.loads(p.TERMS_FILE.read_text())
    looks = json.loads((p.ROOT / "apps/web/lib/engine/looks.json").read_text())
    assert {l["id"] for l in looks} == set(cfg["looks"])
    assert all(t in cfg["terms"] for tids in cfg["looks"].values() for t in tids)


def test_smoothing_with_previous_run_damps_jitter():
    # Same window measured twice: prior estimate jumped from 26,321 to 6,630.
    jumpy = p.term_result(18067, 6630, 0)
    smooth = p.term_result(18067, 6630, 0, prev=(18067, 26321))
    assert jumpy["growth"] > 1.5 and smooth["growth"] < jumpy["growth"]
    assert p.smoothed_ratio((100, 50), (10, 5)) == p.ratio(100, 50)  # previous run too small: ignored


def test_display_caps():
    big = {"growth": 2.5, "enoughData": True, "capped": False, "headlines": 0, "recent": 1, "prior": 1}
    assert "more than doubled" in p.proof_text("x", big)
    assert "down by more than half" in p.proof_text("x", {**big, "growth": -0.7})


def test_rescore_from_history(monkeypatch, tmp_path):
    hist = tmp_path / "history.jsonl"
    entry = lambda r, pr: {"generatedAt": "2026-11-05T06:00:00Z", "terms": {
        t: {"recent": r, "prior": pr, "headlines": 0} for t in json.loads(p.TERMS_FILE.read_text())["terms"]}}
    hist.write_text(json.dumps(entry(500, 1000)) + "\n" + json.dumps(entry(600, 1000)) + "\n")
    out = tmp_path / "trends.json"
    monkeypatch.setattr(p, "HISTORY_FILE", hist)
    monkeypatch.setattr(p, "OUT_FILE", out)
    monkeypatch.setattr(p, "ROOT", tmp_path)
    assert p.rescore() == 0
    d = json.loads(out.read_text())
    assert len(d["looks"]) == 12 and all(v["label"] == "steady" for v in d["looks"].values())
    assert hist.read_text().count("\n") == 2  # rescore doesn't append history
