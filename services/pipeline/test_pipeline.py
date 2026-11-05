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
    },
    "looks": {"a": ["chrome", "burgundy"], "b": ["cat-eye"], "c": ["tiny"], "d": ["missing"]},
    "editorialFeeds": ["https://feed/rss", "https://feed/atom", "https://feed/broken"],
}

# (recent, prior) videos per query
COUNTS = {"chrome nails": (1640, 1000), "burgundy nails": (500, 500), "cat eye nails": (300, 600), "tiny nails": (6, 2)}


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


def test_full_run_with_mocked_sources():
    out = p.run("k", now=NOW, get=fake_get, cfg=CFG)
    t = out["terms"]
    assert t["chrome"]["label"] == "rising" and t["chrome"]["headlines"] == 1  # June story is outside the window
    assert t["burgundy"]["label"] == "steady" and t["burgundy"]["headlines"] == 1
    assert t["cat-eye"]["label"] == "fading" and t["cat-eye"]["headlines"] == 1  # Atom feed counted
    assert t["tiny"]["enoughData"] is False and t["tiny"]["label"] == "steady"
    assert out["feedsRead"] == 2  # broken feed skipped, run continues

    a = out["looks"]["a"]
    assert a["isPlaceholder"] is False and a["term"] == "chrome" and a["badge"] == "↑ Rising"
    assert "64% more new “chrome nails” YouTube videos" in a["text"]
    assert "1 beauty-magazine headline this month" in a["text"]
    assert a["velocity"] == round((2 * t["chrome"]["velocity"] + t["burgundy"]["velocity"]) / 3, 3)
    assert "50% fewer" in out["looks"]["b"]["text"] and out["looks"]["b"]["badge"] == "↓ Cooling"
    assert out["looks"]["c"]["text"].startswith("6 new “tiny nails” YouTube videos")
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
