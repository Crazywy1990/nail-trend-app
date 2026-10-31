from __future__ import annotations

import os
import re
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .catalog import all_looks, get_look
from .ranking import RANKING_VERSION, Filters, apply_feedback, select_set
from .schemas import DiscoverResponse, EventIn, Look, Pick, Profile


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Nail Trend API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("WEB_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- "Describe it" parsing (keyword rules for slice 1; an LLM parser replaces this) ----
OCCASION_WORDS = {
    "work": "work", "office": "work", "meeting": "work", "interview": "work",
    "wedding": "wedding", "bridal": "wedding",
    "vacation": "vacation", "beach": "vacation", "trip": "vacation", "pool": "vacation",
    "date": "date night", "dinner": "date night",
    "party": "holiday party", "holiday": "holiday party", "christmas": "holiday party",
    "new year": "holiday party", "halloween": "party",
}
FINISH_WORDS = {
    "chrome": "chrome", "cat-eye": "cat-eye", "cat eye": "cat-eye", "magnetic": "cat-eye",
    "french": "french", "matte": "matte", "jelly": "jelly", "glossy": "gloss", "gloss": "gloss",
}
LENGTH_WORDS = {"short": "short", "medium": "medium", "long": "long"}


def parse_need(text: str) -> Filters:
    t = (text or "").lower()

    def found(table: dict[str, str]) -> list[str]:
        hits = [v for k, v in table.items() if re.search(rf"\b{re.escape(k)}\b", t)]
        return list(dict.fromkeys(hits))

    return Filters(occasions=found(OCCASION_WORDS), finishes=found(FINISH_WORDS), lengths=found(LENGTH_WORDS))


def merge_filters(a: Filters, b: Filters) -> Filters:
    def u(x: list[str], y: list[str]) -> list[str]:
        return list(dict.fromkeys(x + y))
    return Filters(u(a.occasions, b.occasions), u(a.finishes, b.finishes), u(a.lengths, b.lengths))


def why_for(look: Look, profile: Profile, filters: Filters) -> str:
    if look.why:
        return look.why
    occ = next((o for o in filters.occasions if o in look.occasions), None) or (look.occasions[0] if look.occasions else "everyday")
    return (
        f"Picked for you: a {look.length} {look.shape.lower()} {look.finish} set that fits "
        f"{occ} and pairs with your {profile.jewelry_metal} jewelry. Stretch {look.stretch_level} of 5."
    )


# ---- Routes ----
@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "rankingVersion": RANKING_VERSION}


@app.get("/v1/looks", response_model=list[Look])
def list_looks() -> list[Look]:
    return all_looks()


@app.get("/v1/looks/{look_id}", response_model=Look)
def read_look(look_id: str) -> Look:
    look = get_look(look_id)
    if not look:
        raise HTTPException(404, "Look not found")
    return look


@app.get("/v1/discover", response_model=DiscoverResponse)
def discover(
    user_id: str = Query("demo", alias="userId"),
    q: str = "",
    occasion: list[str] = Query(default=[]),
    finish: list[str] = Query(default=[]),
    length: list[str] = Query(default=[]),
) -> DiscoverResponse:
    filters = merge_filters(Filters(occasion, finish, length), parse_need(q))
    with db.SessionLocal.begin() as s:
        profile = db.get_profile(s, user_id)
        result = select_set(all_looks(), profile, filters)
        set_id = uuid.uuid4().hex

        def pick(look: Look, slot: str, position: int) -> Pick:
            return Pick(
                look=look, slot=slot, position=position,
                relevance=round(result.relevance[look.id], 3),
                photo=look.photo_by_skin_tone.get(profile.skin_tone),
                why=why_for(look, profile, filters),
            )

        hero, rest = result.safe[0], result.safe[1:]
        cards = [pick(hero, "for_you", 0)]
        if result.stretch:
            cards.append(pick(result.stretch, "stretch", 1))
        also = [pick(l, "for_you", i + 2) for i, l in enumerate(rest)]
        if result.trending:
            also.append(pick(result.trending, "trending", len(also) + 2))

        db.record_set(s, set_id, user_id, RANKING_VERSION, {
            "filters": filters.as_dict(),
            "picks": [{"lookId": p.look.id, "slot": p.slot, "position": p.position, "relevance": p.relevance}
                      for p in cards + also],
        })

    n_trend = 1 if result.trending else 0
    n_stretch = 1 if result.stretch else 0
    return DiscoverResponse(
        set_id=set_id,
        ranking_version=RANKING_VERSION,
        filters=filters.as_dict(),
        cards=cards,
        also=also,
        summary=f"{len(result.safe)} for you · {n_trend} trending · {n_stretch} stretch",
    )


@app.post("/v1/events", status_code=201)
def post_event(e: EventIn) -> dict:
    with db.SessionLocal.begin() as s:
        row = db.add_event(s, e)
        look = get_look(e.look_id) if e.look_id else None
        if look:
            profile = db.get_profile(s, e.user_id)
            db.save_profile(s, apply_feedback(profile, look, e.type))
        s.flush()
        return {"id": row.id}


@app.get("/v1/profile/{user_id}", response_model=Profile)
def read_profile(user_id: str) -> Profile:
    with db.SessionLocal() as s:
        return db.get_profile(s, user_id)


@app.put("/v1/profile/{user_id}", response_model=Profile)
def write_profile(user_id: str, profile: Profile) -> Profile:
    profile = profile.model_copy(update={"user_id": user_id})
    with db.SessionLocal.begin() as s:
        db.save_profile(s, profile)
    return profile
