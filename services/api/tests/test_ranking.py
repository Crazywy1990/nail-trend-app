from app.catalog import all_looks, get_look
from app.db import DEMO_PROFILE
from app.ranking import Filters, apply_feedback, select_set

NO_FILTERS = Filters([], [], [])


def ids(looks):
    return [l.id for l in looks]


def test_demo_set_composition():
    r = select_set(all_looks(), DEMO_PROFILE, NO_FILTERS)
    assert len(r.safe) == 6
    assert r.safe[0].id == "burgundy-cat-eye-gold-micro-french"
    assert r.stretch.id == "emerald-chrome-silver-star"
    assert r.trending.id == "deep-teal-velvet-cat-eye"
    # No look appears twice across slots.
    all_ids = ids(r.safe) + [r.trending.id, r.stretch.id]
    assert len(all_ids) == len(set(all_ids))


def test_near_duplicate_of_current_set_is_dropped():
    # Milky pink jelly has the 2nd-highest relevance but duplicates her current pink jelly set.
    r = select_set(all_looks(), DEMO_PROFILE, NO_FILTERS)
    assert "milky-pink-jelly-chrome" not in ids(r.safe)


def test_diversity_caps():
    r = select_set(all_looks(), DEMO_PROFILE, NO_FILTERS)
    picked = r.safe + [r.trending]
    for color in {l.color_family for l in picked}:
        assert sum(l.color_family == color for l in picked) <= 2
    for finish in {l.finish for l in picked}:
        assert sum(l.finish == finish for l in picked) <= 3


def test_finish_filter_narrows_safe_picks_first():
    r = select_set(all_looks(), DEMO_PROFILE, Filters([], ["chrome"], []))
    assert r.safe[0].finish == "chrome"
    assert len(r.safe) == 6  # topped up from unfiltered looks when chrome runs out


def test_too_bold_lowers_stretch_ceiling():
    emerald = get_look("emerald-chrome-silver-star")
    p = apply_feedback(DEMO_PROFILE, emerald, "too_bold")
    assert p.max_stretch == 3
    r = select_set(all_looks(), p, NO_FILTERS)
    assert r.stretch is None or r.stretch.stretch_level <= 3


def test_save_raises_affinity():
    look = get_look("mocha-aura-brown-chrome")
    p = apply_feedback(DEMO_PROFILE, look, "save")
    assert p.affinity["finish:chrome"] > 0.5
    assert p.affinity["color:brown"] > 0.5


def test_only_the_five_checked_codes_are_verified():
    verified = sorted(s.code for l in all_looks() for s in l.shades if s.verified)
    assert verified == ["GC H22", "GC L00", "GC L87", "GC N25", "GC S86"]
    assert all(s.code is None for l in all_looks() for s in l.shades if not s.verified)
