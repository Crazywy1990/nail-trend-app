import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rednote as r


def note(kw, likes, saves):
    return {"keyword": kw, "engagement": {"liked_count": likes, "collected_count": saves}}


def test_engagement_parses_wan_and_commas():
    assert r.engagement({"engagement": {"liked_count": "1.2万", "collected_count": "3,400"}}) == (12000, 3400)
    assert r.engagement({}) == (0, 0)


def test_summarize_week_over_week():
    notes = [note("猫眼美甲", 100, 50), note("猫眼美甲", 10, 5), note("法式美甲", 40, 10)]
    t = r.summarize(notes, {"cat-eye": {"engagement": 110}})
    assert t["cat-eye"]["notes"] == 2 and t["cat-eye"]["engagement"] == 165 and t["cat-eye"]["change"] == 0.5
    assert t["french"]["change"] is None and t["theme:christmas"]["notes"] == 0
