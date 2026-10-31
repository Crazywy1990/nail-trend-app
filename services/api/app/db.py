"""Persistence for profiles and the event log.

DATABASE_URL defaults to a local SQLite file; set it to a Postgres URL
(postgresql+psycopg://...) in staging/production.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .schemas import CurrentSet, EventIn, Profile

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class EventRow(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    type: Mapped[str] = mapped_column(String(32), index=True)
    look_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    set_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    slot: Mapped[str | None] = mapped_column(String(16), nullable=True)
    position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    utm_source: Mapped[str | None] = mapped_column(String(128), nullable=True)


class ProfileRow(Base):
    __tablename__ = "profiles"
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    data: Mapped[str] = mapped_column(Text)


class SetRow(Base):
    """Every served set, so impressions can be joined to what was ranked and how."""
    __tablename__ = "served_sets"
    set_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    ranking_version: Mapped[str] = mapped_column(String(32))
    payload: Mapped[str] = mapped_column(Text)


def init_db() -> None:
    Base.metadata.create_all(engine)


DEMO_PROFILE = Profile(
    user_id="demo",
    skin_tone="medium",
    undertone="warm",
    jewelry_metal="gold",
    current=CurrentSet(color_family="pink", finish="jelly"),
)


def get_profile(s: Session, user_id: str) -> Profile:
    row = s.get(ProfileRow, user_id)
    if row:
        return Profile.model_validate_json(row.data)
    return DEMO_PROFILE.model_copy(update={"user_id": user_id})


def save_profile(s: Session, profile: Profile) -> None:
    row = s.get(ProfileRow, profile.user_id)
    data = profile.model_dump_json()
    if row:
        row.data = data
    else:
        s.add(ProfileRow(user_id=profile.user_id, data=data))


def add_event(s: Session, e: EventIn) -> EventRow:
    row = EventRow(**e.model_dump())
    s.add(row)
    return row


def record_set(s: Session, set_id: str, user_id: str, version: str, payload: dict) -> None:
    s.add(SetRow(set_id=set_id, user_id=user_id, ranking_version=version, payload=json.dumps(payload)))


def recent_events(s: Session, user_id: str, limit: int = 50) -> list[EventRow]:
    q = select(EventRow).where(EventRow.user_id == user_id).order_by(EventRow.id.desc()).limit(limit)
    return list(s.scalars(q))
