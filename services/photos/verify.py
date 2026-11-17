"""Second-opinion checks by a separate vision model before a person sees a draft.

  verify_look(look, photo, catalog)  → is the photo faithful to the spec, is the hand natural,
                                       is the spec realistic, is it a near-duplicate?
  verify_tone(look, photo, reference, tone) → did a skin-tone edit keep the nails identical?

Each check is one OpenAI chat call with the image(s) attached (≈ $0.01–0.03). The model is a
different, stronger model than the one that drafted the look. Scores are 1–5; the verdict is
computed here from the scores (not left to the model): fail if anything scores ≤ 2 or the look
is a near-duplicate, warn if anything scores 3, otherwise pass.

CLI: OPENAI_API_KEY=... python services/photos/verify.py [--drafts] [lookId ...]
     prints a Markdown report for the given looks (or every look with a "draft" field).
"""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate as g  # noqa: E402

VERIFY_MODELS = [m for m in [os.environ.get("OPENAI_VERIFY_MODEL"), "gpt-5.5", "gpt-5.4", "gpt-4.1"] if m]

LOOK_RUBRIC = """You are a senior nail technician and photo editor reviewing a DRAFT look for a nail-design app before it goes to a human approver. Clients book from this photo and a nail tech works from the spec, so be strict and concrete.

SPEC
{spec}

EXISTING CATALOG (check for near-duplicates)
{catalog}

Look at the photo and score each item 1-5 (5 = fully correct, 3 = noticeable problem, 1 = wrong):
  color_match: nail colors match the spec
  finish_match: the finish/technique is visibly what the spec says (e.g. chrome sheen, magnetic cat-eye stripe, matte, sheer jelly, French tips, aura glow)
  shape_length_match: nail shape and length match the spec, consistent across nails
  hand_anatomy: one natural hand, correct finger count and joints, no fused/extra/missing fingers, nails sit naturally
  photo_quality: in focus, realistic, no text/watermark/artifacts, nails clearly visible
  spec_realism: the technique is doable in a standard salon appointment and price/time fit a typical US salon
  spec_consistency: name, technique, shades, finish and color family agree with each other
Also set near_duplicate (true/false) and duplicate_of (catalog name or null).
Return JSON: {{"scores": {{...}}, "near_duplicate": bool, "duplicate_of": string|null, "issues": [short concrete problems], "photo_fix": "one sentence telling the photographer what to change, or empty"}}"""

TONE_RUBRIC = """Two photos of the same manicure. The FIRST is the approved reference. The SECOND should be identical except the hand's skin changed to: {tone_desc}.
Score 1-5:
  nails_unchanged: same nail color, finish, art, shape and length on every nail
  scene_unchanged: same rings/accessories, props, fabric, background, framing and light
  tone_correct: the skin in the second photo clearly is {tone_desc}, with natural texture
  hand_anatomy: natural hand, correct fingers and joints
Return JSON: {{"scores": {{...}}, "issues": [short concrete problems], "photo_fix": "one sentence of what to correct, or empty"}}"""


def _img(b: bytes) -> dict:
    return {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(b).decode()}}


def _ask(text: str, images: list[bytes], key: str) -> dict:
    last = None
    for model in VERIFY_MODELS:
        body = json.dumps({"model": model, "response_format": {"type": "json_object"},
                           "messages": [{"role": "user", "content": [{"type": "text", "text": text}] + [_img(b) for b in images]}]}).encode()
        req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body, method="POST",
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            out = json.loads(g.http(req, timeout=180))
            res = json.loads(out["choices"][0]["message"]["content"])
            res["model"] = model
            return res
        except RuntimeError as e:
            last = e
            if "model" in str(e).lower() or "404" in str(e):
                continue
            raise
    raise RuntimeError(f"no verify model worked: {last}")


def verdict(res: dict) -> str:
    scores = [int(v) for v in (res.get("scores") or {}).values() if str(v).isdigit()]
    if res.get("near_duplicate") or not scores or min(scores) <= 2:
        return "fail"
    return "warn" if min(scores) == 3 else "pass"


def spec_text(l: dict) -> str:
    shades = "; ".join((f"{s.get('brand')} " if s.get("brand") else "") + s.get("name", "") for s in l.get("shades", []))
    return (f"Name: {l['name']}\nTechnique: {l['technique']}\nSystem: {l.get('system')}\nFinish: {l['finish']}\n"
            f"Color family: {l['colorFamily']}\nShape/length: {l['shape']} / {l['length']}\n"
            f"Price/time: {l.get('priceRange')} / {l.get('durationMin')} min\nShades: {shades}\n"
            f"Photo brief: {l.get('photoBrief', '')}")


def verify_look(look: dict, photo: bytes, catalog: list[dict], key: str) -> dict:
    cat = "\n".join(f"- {c['name']} ({c['technique']})" for c in catalog if c["id"] != look["id"])
    res = _ask(LOOK_RUBRIC.format(spec=spec_text(look), catalog=cat), [photo], key)
    res["verdict"] = verdict(res)
    return res


def verify_tone(look: dict, photo: bytes, reference: bytes, tone_desc: str, key: str) -> dict:
    res = _ask(TONE_RUBRIC.format(tone_desc=tone_desc), [reference, photo], key)
    res["verdict"] = verdict(res)
    return res


ICON = {"pass": "✅ Pass", "warn": "⚠️ Check", "fail": "❌ Fail"}


def report_md(look: dict, res: dict, attempts: int = 1) -> str:
    sc = res.get("scores", {})
    row = " · ".join(f"{k.replace('_', ' ')} {v}/5" for k, v in sc.items())
    lines = [f"- **AI review ({res.get('model', '?')}): {ICON[res['verdict']]}**" + (f" (photo regenerated {attempts - 1}×)" if attempts > 1 else ""),
             f"  - {row}"]
    if res.get("near_duplicate"):
        lines.append(f"  - Near-duplicate of: {res.get('duplicate_of')}")
    for i in res.get("issues", [])[:5]:
        lines.append(f"  - {i}")
    return "\n".join(lines)


def main() -> int:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        print("OPENAI_API_KEY is not set.", file=sys.stderr); return 1
    looks = json.loads((g.ROOT / "apps/web/lib/engine/looks.json").read_text())
    ids = [a for a in sys.argv[1:] if not a.startswith("--")]
    todo = [l for l in looks if (l["id"] in ids if ids else "draft" in l)]
    main_looks = os.environ.get("MAIN_LOOKS")  # skip drafts that are already approved on main
    if not ids and main_looks and Path(main_looks).exists():
        approved = {l["id"] for l in json.loads(Path(main_looks).read_text())}
        todo = [l for l in todo if l["id"] not in approved]
    out = []
    for l in todo:
        photo = (g.ROOT / "apps/web/public" / l["photoBySkinTone"]["medium"].lstrip("/")).read_bytes()
        res = verify_look(l, photo, looks, key)
        out.append(f"### {l['name']}\n{report_md(l, res)}\n")
        print(f"  {l['id']:40s} {res['verdict']}  {res.get('scores')}", file=sys.stderr)
    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
