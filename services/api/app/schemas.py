"""Data model for looks, profiles, discover sets and events.

Field notes
-----------
system   Product system: "gel" | "builder gel" | "Gel-X" ... Shown in the meta line.
finish   Visual finish: "chrome" | "cat-eye" | "french" | "matte" | "jelly" | "gloss" | "art".
         Used for diversity caps and the Finish chips. Not shown in the meta line.
trend_proof.is_placeholder
         True for every look until the trend pipeline exists. The UI shows a
         "Sample data" tag whenever it is true.
shades[].code
         The full formula-prefixed code. OPI shares the base code across formulas but
         the prefix differs: GC = GelColor, NL = Nail Lacquer, ISL = Infinite Shine.
shades[].verified
         True only for codes checked against the brand catalog. The UI prints any
         unverified code as "code to verify".
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Shade(CamelModel):
    brand: str | None = None
    name: str
    code: str | None = None
    verified: bool = False


class TrendProof(CamelModel):
    text: str | None = None
    is_placeholder: bool = True


class WhyInputs(CamelModel):
    undertone: str | None = None
    jewelry_metal: str | None = None
    occasion_fit: str | None = None


class Look(CamelModel):
    id: str
    name: str
    technique: str
    system: str
    finish: str
    color_family: str
    shape: str
    length: str
    price_range: str
    duration_min: int
    stretch_level: int = Field(ge=1, le=5)
    fit_prior: float = Field(ge=0, le=1, description="Base fit before personal affinity")
    trend_velocity: float = Field(ge=0, le=1)
    trend_sources: list[str] = []
    trend_proof: TrendProof = TrendProof()
    shades: list[Shade] = []
    photo_by_skin_tone: dict[str, str | None] = {}
    photo_pos: str = "center"
    photo_alt: str | None = None
    photo_brief: str | None = None
    occasions: list[str] = []
    why: str | None = None
    why_inputs: WhyInputs = WhyInputs()


class CurrentSet(CamelModel):
    color_family: str
    finish: str


class Profile(CamelModel):
    user_id: str
    skin_tone: Literal["light", "medium", "deep"] = "medium"
    undertone: Literal["warm", "cool", "neutral"] = "neutral"
    jewelry_metal: Literal["gold", "silver", "mixed"] = "mixed"
    current: CurrentSet | None = None
    # Attribute affinities in [0, 1], keyed like "color:red", "finish:chrome".
    affinity: dict[str, float] = {}
    # Highest stretch level she has not rejected as "Too bold".
    max_stretch: int = 5


SlotName = Literal["for_you", "trending", "stretch"]


class Pick(CamelModel):
    look: Look
    slot: SlotName
    position: int
    relevance: float
    photo: str | None = None
    why: str


class DiscoverResponse(CamelModel):
    set_id: str
    ranking_version: str
    filters: dict[str, list[str]]
    cards: list[Pick]          # hero + stretch, shown as full cards
    also: list[Pick]           # remaining picks, shown as compact rows
    summary: str


EventType = Literal[
    "impression", "save", "unsave", "reject", "too_bold",
    "book_click", "share_click", "landing",
]


class EventIn(CamelModel):
    user_id: str
    type: EventType
    look_id: str | None = None
    set_id: str | None = None
    slot: SlotName | None = None
    position: int | None = None
    path: str | None = None
    ref: str | None = None
    utm_source: str | None = None


class EventOut(EventIn):
    id: int
    created_at: datetime
