"""AI skin retouch for existing look photos (feedback: hands looked rough — freckles, creases).

For each photo used by the catalog (every look, every skin tone) that isn't retouched yet:
  edit the clean original with OpenAI: smooth, even, refined skin; nails, rings, background,
  framing, light and skin tone unchanged → AI check (nails/scene unchanged, tone kept, skin
  smooth, natural hand) → one retry with the reviewer's fix → otherwise the photo is left as is.
Progress is kept in assets/looks/retouched.json, so a rerun only does what's left (no double cost).
Retouching one of the two original photos marks that look's photoSource as "edited".

Run: OPENAI_API_KEY=... python services/photos/retouch.py [--max N]
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate as g  # noqa: E402
import verify as v  # noqa: E402
from watermark import NOT_AI, ORIGINALS, save_photo  # noqa: E402

LOOKS = g.ROOT / "apps/web/lib/engine/looks.json"
DONE = ORIGINALS / "retouched.json"
PROMPT = ("Retouch ONLY the skin of the hand: make it smooth, even and refined like a high-end nail-polish or "
          "hand-cream ad — remove freckles, spots and blotches, soften knuckle creases and fine wrinkles — while "
          "keeping it real (fine pores visible, never plastic or waxy). Keep EXACTLY the same: skin tone and "
          "undertone, hand pose and shape, every nail (color, finish, shape, length, art, shine), every ring, the "
          "props, fabric, background, framing, camera angle and lighting. No text, no watermark.")


def main() -> int:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        print("OPENAI_API_KEY is not set.", file=sys.stderr); return 1
    limit = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 80
    g.PER_MODEL = 1
    looks = json.loads(LOOKS.read_text())
    done = json.loads(DONE.read_text()) if DONE.exists() else {}
    todo = []
    for l in looks:
        for tone in ("medium", "light", "deep"):
            src = (l.get("photoBySkinTone") or {}).get(tone)
            name = Path(src).name if src else None
            if name and name not in done and (ORIGINALS / name).exists() and name not in {t[1] for t in todo}:
                todo.append((l, name, tone))
    print(f"{len(todo)} photos to retouch; doing up to {limit}.")
    ok = failed = 0
    for l, name, tone in todo[:limit]:
        ref = ORIGINALS / name
        before = ref.read_bytes()
        saved = g.REFS
        g.REFS = [ref]
        try:
            fix, result = "", None
            for attempt in (1, 2):
                raw = g.openai(PROMPT + (f" Correction: {fix}" if fix else ""), key, g.OPENAI_MODEL)[0]
                rv = v.verify_tone(l, raw, before, "the SAME skin tone as the first photo, now smooth, even and refined", key)
                print(f"  {name:48s} attempt {attempt}: {rv['verdict']} {rv.get('scores')}")
                if rv["verdict"] != "fail":
                    result = raw
                    break
                fix = rv.get("photo_fix") or "; ".join(rv.get("issues", [])[:3])
        except RuntimeError as e:
            print(f"  FAIL {name}: {str(e)[:200]}", file=sys.stderr)
            if "insufficient_quota" in str(e) or "credit" in str(e).lower():
                print("::warning::OpenAI credit ran out; rerun after adding credit — finished photos are kept.")
                break
            failed += 1
            continue
        finally:
            g.REFS = saved
        if result is None:
            failed += 1
            print(f"  KEEP {name}: retouch failed review twice; the current photo stays")
            continue
        save_photo(result, name)
        done[name] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if name in NOT_AI:
            l["photoSource"] = "edited"
        ok += 1
        DONE.write_text(json.dumps(done, indent=2) + "\n")
        LOOKS.write_text(json.dumps(looks, indent=2, ensure_ascii=False) + "\n")
    print(f"Retouched {ok}; failed {failed}; remaining {max(0, len(todo) - ok - failed)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
