import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import discover as d

NOW = datetime(2026, 11, 16, tzinfo=timezone.utc)
CFG = {"terms": {k: {"label": f"{k} nails"} for k in ("a", "b", "c", "e")},
       "looks": {"l1": ["a", "b"], "l2": ["a"], "l3": ["b"], "l4": ["c"]}}
TR = {"terms": {
    "a": {"label": "rising", "enoughData": True, "growth": 0.9},   # 2 looks → covered
    "b": {"label": "rising", "enoughData": True, "growth": 0.5},   # 2 looks → covered
    "c": {"label": "rising", "enoughData": True, "growth": 0.4},   # 1 look → gap
    "e": {"label": "rising", "enoughData": True, "growth": 1.2},   # 0 looks → gap, biggest
}}


def test_gaps_ranked_and_capped():
    assert d.find_gaps(TR, CFG, {"drafted": {}}, NOW) == ["e", "c"]


def test_cooldown_and_quiet_weeks_cost_nothing():
    assert d.find_gaps(TR, CFG, {"drafted": {"e": "2026-11-01T00:00:00+00:00"}}, NOW) == ["c"]
    quiet = {"terms": {k: {**v, "label": "steady"} for k, v in TR["terms"].items()}}
    assert d.find_gaps(quiet, CFG, {"drafted": {}}, NOW) == []


def test_draft_is_sanitized():
    raw = {"name": "Emerald Velvet · Micro French", "finish": "glitter", "colorFamily": "green", "shape": "Stiletto",
           "durationMin": 999, "stretchLevel": 9, "occasions": ["work", "rave"], "terms": ["zzz", "a"],
           "shades": [{"brand": "OPI", "name": "Stay Off the Lawn!!", "code": "GC X99"}]}
    look, terms = d.to_look(raw, "e", CFG, {"emerald-velvet-micro-french"})
    assert look["id"] == "emerald-velvet-micro-french-2"
    assert look["finish"] == "gloss" and look["shape"] == "Almond"
    assert look["durationMin"] == 150 and look["stretchLevel"] == 5 and look["occasions"] == ["work"]
    assert terms == ["e", "a"]
    assert look["shades"][0]["code"] is None and look["shades"][0]["verified"] is False  # never trust model codes
    seed = d.to_seed(look)
    assert seed["color_family"] == "green" and seed["trend_proof"]["is_placeholder"] is True and "draft" not in seed


THEMES = {
    "christmas": {"label": "Christmas", "colors": ["red", "green", "white"], "finishes": ["chrome"],
                  "window": ["11-25", "12-26"], "leadDays": 30, "brief": ""},
    "thanksgiving": {"label": "Thanksgiving", "colors": ["brown"], "finishes": ["matte"],
                     "window": ["11-01", "11-27"], "leadDays": 21, "brief": ""},
    "new-year": {"label": "NYE", "colors": ["white"], "finishes": ["chrome"],
                 "window": ["12-27", "01-01"], "leadDays": 21, "brief": ""},
}
LOOKS = [{"colorFamily": c} for c in ["red", "red", "green", "white", "brown", "nude"]]


def test_theme_gaps_respect_lead_time_runway_and_count():
    now = datetime(2026, 11, 16, tzinfo=timezone.utc)
    # Christmas is 9 days away (inside 30-day lead) with 4 looks < 6 → gap.
    # Thanksgiving ends in 11 days (< 14-day runway) → skipped. NYE lead starts Dec 6 → not yet.
    assert d.find_theme_gaps(THEMES, LOOKS, {"drafted": {}}, now) == ["christmas"]
    assert d.find_theme_gaps(THEMES, LOOKS * 2, {"drafted": {}}, now) == []          # 8 looks: enough
    assert d.find_theme_gaps(THEMES, LOOKS, {"drafted": {"theme:christmas": "2026-11-10T00:00:00+00:00"}}, now) == []
    # NYE window wraps the year end
    s, e = d.theme_dates(THEMES["new-year"], datetime(2026, 12, 30, tzinfo=timezone.utc))
    assert (s.month, s.day, e.year, e.month, e.day) == (12, 27, 2027, 1, 1)
