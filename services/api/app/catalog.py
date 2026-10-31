"""Look catalog. Slice 1 reads the seed file; the trend pipeline replaces it later."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .schemas import Look

SEED = Path(__file__).parent / "seed" / "looks.json"


@lru_cache
def all_looks() -> list[Look]:
    return [Look.model_validate(row) for row in json.loads(SEED.read_text(encoding="utf-8"))]


def get_look(look_id: str) -> Look | None:
    return next((l for l in all_looks() if l.id == look_id), None)
