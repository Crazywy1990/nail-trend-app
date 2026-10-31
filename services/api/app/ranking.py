"""Set selection for the Discover feed.

Relevance decides eligibility; novelty decides the final set.

A set of 8 = 6 personalized-safe picks + 1 trending pick + 1 stretch pick.
Safe picks are chosen greedily with MMR: each step maximizes
    LAMBDA * relevance - (1 - LAMBDA) * max_similarity(candidate, anchors)
where anchors are her current set plus everything already picked, so near-duplicates
of what she is wearing (and of each other) are pushed out. Hard caps keep color
families and finishes varied.
"""
from __future__ import annotations

from dataclasses import dataclass

from .schemas import Look, Profile

RANKING_VERSION = "mmr-v1"
LAMBDA = 0.7
SAFE_MIN = 0.60       # relevance needed for a personalized-safe pick
STRETCH_MIN = 0.42    # relevance needed for the trending and stretch slots
MAX_PER_COLOR = 2
MAX_PER_FINISH = 3
SAFE_COUNT = 6
OCCASION_BOOST = 0.08


@dataclass
class Filters:
    occasions: list[str]
    finishes: list[str]
    lengths: list[str]

    def as_dict(self) -> dict[str, list[str]]:
        return {"occasion": self.occasions, "finish": self.finishes, "length": self.lengths}


@dataclass
class SetResult:
    safe: list[Look]
    trending: Look | None
    stretch: Look | None
    relevance: dict[str, float]


def _attr_keys(look: Look) -> list[str]:
    return [
        f"color:{look.color_family}",
        f"finish:{look.finish}",
        f"shape:{look.shape.lower()}",
        f"length:{look.length}",
    ]


def relevance(look: Look, profile: Profile, filters: Filters) -> float:
    attrs = [profile.affinity.get(k, 0.5) for k in _attr_keys(look)]
    score = 0.6 * look.fit_prior + 0.4 * (sum(attrs) / len(attrs))
    if filters.occasions and set(filters.occasions) & set(look.occasions):
        score += OCCASION_BOOST
    return max(0.0, min(1.0, score))


def similarity(a_color: str, a_finish: str, b_color: str, b_finish: str) -> float:
    return (0.6 if a_color == b_color else 0.0) + (0.4 if a_finish == b_finish else 0.0)


def _matches_hard_filters(look: Look, f: Filters) -> bool:
    if f.finishes and look.finish not in f.finishes:
        return False
    if f.lengths and look.length not in f.lengths:
        return False
    return True


def _mmr_pick(candidates: list[Look], picked: list[Look], profile: Profile,
              rel: dict[str, float]) -> Look | None:
    anchors: list[tuple[str, str]] = [(p.color_family, p.finish) for p in picked]
    if profile.current:
        anchors.append((profile.current.color_family, profile.current.finish))
    best, best_score = None, float("-inf")
    for look in candidates:
        if look in picked:
            continue
        if sum(p.color_family == look.color_family for p in picked) >= MAX_PER_COLOR:
            continue
        if sum(p.finish == look.finish for p in picked) >= MAX_PER_FINISH:
            continue
        max_sim = max((similarity(look.color_family, look.finish, c, f) for c, f in anchors), default=0.0)
        score = LAMBDA * rel[look.id] - (1 - LAMBDA) * max_sim
        if score > best_score:
            best, best_score = look, score
    return best


def select_set(pool: list[Look], profile: Profile, filters: Filters) -> SetResult:
    rel = {l.id: relevance(l, profile, filters) for l in pool}

    # A stretch pick sits at the edge of her taste: level 4-5 by default, or her
    # learned ceiling once "Too bold" taps have lowered it.
    lo = min(4, profile.max_stretch)
    stretch_candidates = [
        l for l in pool
        if lo <= l.stretch_level <= profile.max_stretch and rel[l.id] >= STRETCH_MIN
    ]
    stretch = max(stretch_candidates, key=lambda l: rel[l.id] + l.trend_velocity, default=None)

    safe_all = [l for l in pool if l is not stretch and l.stretch_level <= 3 and rel[l.id] >= SAFE_MIN]
    safe_filtered = [l for l in safe_all if _matches_hard_filters(l, filters)] or safe_all

    safe: list[Look] = []
    hero = _mmr_pick(safe_filtered, safe, profile, rel)
    if hero:
        safe.append(hero)

    trending_pool = [
        l for l in pool
        if l is not stretch and l not in safe and l.stretch_level <= 3 and rel[l.id] >= STRETCH_MIN
    ]
    trending = max(trending_pool, key=lambda l: l.trend_velocity, default=None)

    picked = safe + ([trending] if trending else [])
    # Fill from the filtered pool first, then top up from all safe looks.
    for source in (safe_filtered, safe_all):
        while len(safe) < SAFE_COUNT:
            nxt = _mmr_pick([l for l in source if l is not trending], picked, profile, rel)
            if nxt is None:
                break
            safe.append(nxt)
            picked.append(nxt)

    return SetResult(safe=safe, trending=trending, stretch=stretch, relevance=rel)


# ---- Feedback: online affinity updates from events ----
EVENT_DELTAS = {
    "save": 0.05,
    "unsave": -0.05,
    "book_click": 0.10,
    "share_click": 0.04,
    "reject": -0.05,
    "too_bold": -0.03,
}


def apply_feedback(profile: Profile, look: Look, event_type: str) -> Profile:
    delta = EVENT_DELTAS.get(event_type)
    if delta is None:
        return profile
    aff = dict(profile.affinity)
    for k in _attr_keys(look):
        aff[k] = max(0.0, min(1.0, aff.get(k, 0.5) + delta))
    max_stretch = profile.max_stretch
    if event_type == "too_bold":
        # Marks the edge of her taste: stop offering this stretch level and above.
        max_stretch = max(3, min(max_stretch, look.stretch_level - 1))
    return profile.model_copy(update={"affinity": aff, "max_stretch": max_stretch})
