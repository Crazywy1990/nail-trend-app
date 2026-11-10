"""Fill every empty photo slot in the catalog with an OpenAI-generated photo, and wire it in.

Slots are (look, skin tone) for tones light / medium / deep.
  - A look with no photo at all gets a medium-tone photo first, styled after the two
    original photos (same prompt as generate.py, OpenAI candidate 1 — the chosen setup).
  - Light and deep versions are edits of that look's medium photo: same nails, jewelry,
    props, background and light; only the skin changes. This keeps the tones consistent.
Writes apps/web/public/looks/<id>.jpg (medium) or <id>__<tone>.jpg, and updates
apps/web/lib/engine/looks.json and services/api/app/seed/looks.json.

Run: OPENAI_API_KEY=... python services/photos/fill.py [--max N] [lookId ...]
"""
from __future__ import annotations

import io
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate as g  # noqa: E402

WEB_LOOKS = g.ROOT / "apps/web/lib/engine/looks.json"
SEED_LOOKS = g.ROOT / "services/api/app/seed/looks.json"
PUBLIC = g.ROOT / "apps/web/public/looks"
TONES = ("medium", "light", "deep")
SKIN = {
    "light": "light, fair skin with a neutral undertone and a few faint freckles",
    "deep": "deep, rich dark-brown skin with a warm undertone",
}


def tone_prompt(look: dict, tone: str) -> str:
    return (
        f"Edit this photo. Keep everything exactly the same: the nails (shape, length, color, finish and any nail "
        f"art: {look['technique']}), every ring and accessory, the props, the fabric, the background, the "
        f"composition, the camera angle and the lighting. Change only the hand's skin to {SKIN[tone]}, with "
        f"natural skin texture and realistic knuckles and cuticles. The hand stays anatomically correct. "
        f"No text, no watermark."
    )


def save_jpeg(raw: bytes, path: Path) -> None:
    try:
        from PIL import Image
        Image.open(io.BytesIO(raw)).convert("RGB").save(path, quality=84, optimize=True, progressive=True)
    except ImportError:
        path.write_bytes(raw)


def slots_of(look: dict) -> dict:
    return look.get("photoBySkinTone") or {}


def main() -> int:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        print("OPENAI_API_KEY is not set.", file=sys.stderr); return 1
    args = sys.argv[1:]
    limit = 999
    if "--max" in args:
        i = args.index("--max"); limit = int(args[i + 1]); del args[i:i + 2]
    only = set(args)
    g.PER_MODEL = 1
    looks = json.loads(WEB_LOOKS.read_text())
    done, failed = 0, 0
    for l in looks:
        if only and l["id"] not in only:
            continue
        s = l.setdefault("photoBySkinTone", {})
        for tone in TONES:
            if s.get(tone) or done >= limit:
                continue
            name = f"{l['id']}.jpg" if tone == "medium" else f"{l['id']}__{tone}.jpg"
            try:
                if tone == "medium":
                    raw = g.openai(g.prompt_for(l), key, g.OPENAI_MODEL)[0]
                else:
                    if not s.get("medium"):
                        continue  # medium failed this run; try the other tones next run
                    ref = g.ROOT / "apps/web/public" / s["medium"].lstrip("/")
                    saved_refs = g.REFS
                    g.REFS = [ref]
                    try:
                        raw = g.openai(tone_prompt(l, tone), key, g.OPENAI_MODEL)[0]
                    finally:
                        g.REFS = saved_refs
            except RuntimeError as e:
                failed += 1
                print(f"  FAIL {l['id']:36s} {tone:6s} {e}", file=sys.stderr)
                continue
            save_jpeg(raw, PUBLIC / name)
            s[tone] = f"/looks/{name}"
            if tone == "medium":
                l["photoPos"] = l.get("photoPos") or "center"
                l["photoAlt"] = l.get("photoAlt") or f"{l['name']}: {l['technique'].lower()} on a warm-toned hand"
            done += 1
            print(f"  ok   {l['id']:36s} {tone:6s} → {name}")
            WEB_LOOKS.write_text(json.dumps(looks, indent=2, ensure_ascii=False) + "\n")  # save as we go

    # mirror into the Python service's seed (snake_case keys)
    if SEED_LOOKS.exists():
        by = {l["id"]: l for l in looks}
        seed = json.loads(SEED_LOOKS.read_text())
        for x in seed:
            if x["id"] in by:
                x["photo_by_skin_tone"] = by[x["id"]]["photoBySkinTone"]
        SEED_LOOKS.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n")
    print(f"Filled {done} slot(s); {failed} failed.")
    return 0 if not failed or done else 1


if __name__ == "__main__":
    sys.exit(main())
