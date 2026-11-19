"""Repair technique lines that were cut off at 120 characters by an old drafting bug.

For each look whose technique is exactly 120 characters (the old hard cut), a vision model
rewrites the full technique from the look's photo and its partial text, so the spec matches
what the photo actually shows. ~$0.01–0.02 per look.

Run: OPENAI_API_KEY=... python services/discovery/repair_specs.py <looks.json or catalog-staging/batch.json> [...]
"""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "photos"))
import generate as g  # noqa: E402
import verify as v  # noqa: E402

ROOT = g.ROOT
PROMPT = """You are a senior nail technician writing the technique line of a salon spec.
Look: {name} — finish {finish}, color family {color}, {shape}, {length}, {system}.
The old technique text was cut off mid-sentence: "{partial}"
Write the COMPLETE technique (1–2 sentences, at most 300 characters) describing exactly what this photo shows,
keeping the intent of the old text where the photo agrees with it. Return JSON: {{"technique": string}}"""


def photo_for(look: dict, batch_file: Path) -> bytes | None:
    name = Path(look["photoBySkinTone"]["medium"]).name
    cwd = Path.cwd()  # the branch being repaired (the tool itself may run from elsewhere)
    for p in (batch_file.parent / "photos" / name, cwd / "assets/looks" / name, cwd / "apps/web/public/looks" / name):
        if p.exists():
            return p.read_bytes()
    return None


def fix(look: dict, photo: bytes, key: str) -> str:
    text = PROMPT.format(name=look["name"], finish=look["finish"], color=look["colorFamily"], shape=look["shape"],
                         length=look["length"], system=look.get("system", "gel"), partial=look["technique"])
    for model in v.VERIFY_MODELS:
        body = json.dumps({"model": model, "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": [
            {"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(photo).decode()}}]}]}).encode()
        req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body, method="POST",
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            out = json.loads(g.http(req, timeout=120))
            return json.loads(out["choices"][0]["message"]["content"])["technique"].strip()[:320]
        except RuntimeError as e:
            if "model" in str(e).lower() or "404" in str(e):
                continue
            raise
    raise RuntimeError("no model worked")


def main() -> int:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        print("OPENAI_API_KEY is not set.", file=sys.stderr); return 1
    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"skip {arg} (missing)"); continue
        data = json.loads(path.read_text())
        looks = data if isinstance(data, list) else [it["look"] for items in data["batches"].values() for it in items]
        n = 0
        for l in looks:
            if len(l.get("technique", "")) != 120:
                continue
            photo = photo_for(l, path)
            if not photo:
                print(f"  no photo for {l['id']}"); continue
            l["technique"] = fix(l, photo, key)
            l["photoAlt"] = f"{l['name']}: {l['technique'][:120].rstrip('.').lower()}"
            n += 1
            print(f"  fixed {l['id']}: {l['technique']}")
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        print(f"{arg}: repaired {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
