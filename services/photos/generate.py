"""Generate candidate photos for looks that have none yet (standard library only).

For each look without a photo, asks two image models for candidates, using the two
existing photos as style references (skin, light, framing, fabric):
  - Meta Muse Image (fal: meta/muse-image/edit)            secret FAL_KEY
  - OpenAI GPT Image (images/edits)                         secret OPENAI_API_KEY
Writes candidates/<lookId>/<model>-<n>.jpg plus candidates/manifest.json.
Nothing is wired into the app; a person picks the winners.

Run: FAL_KEY=... OPENAI_API_KEY=... python services/photos/generate.py [lookId ...]
"""
from __future__ import annotations

import base64
import concurrent.futures as cf
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOOKS = ROOT / "apps/web/lib/engine/looks.json"
REFS = [ROOT / "apps/web/public/looks/burgundy-cat-eye.jpg", ROOT / "apps/web/public/looks/emerald-chrome.jpg"]
OUT = ROOT / "candidates"
PER_MODEL = int(os.environ.get("PER_MODEL", "2"))
OPENAI_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2.5-sunburst")
OPENAI_FALLBACK = "gpt-image-2"

COLOR_WORDS = {
    "pink": "sheer milky pink", "white": "milky oat white", "brown": "rich brown", "red": "cherry red",
    "nude": "sheer natural nude", "blue": "deep teal blue", "green": "emerald green", "multi": "mixed jewel tones",
}

STYLE = (
    "Match the photographic style of the two reference photos exactly: an editorial close-up of one woman's hand, "
    "warm-toned medium skin with natural texture and a few freckles, soft directional window light, shallow depth "
    "of field, rich tactile fabric filling the background, muted elegant palette, shot on a full-frame camera with "
    "a macro lens, 4:3 landscape framing. Do NOT copy the nail color, nail art or jewelry from the references; they "
    "show style only. The hand must be anatomically correct: one hand, four fingers and a thumb, natural joints, "
    "all five nails clearly visible and in focus, same shape and length on every nail, clean cuticles, salon-fresh "
    "gel manicure. No text, no logos, no watermark, no extra hands."
)


def prompt_for(l: dict) -> str:
    shades = ", ".join(s["name"] for s in l.get("shades", [])) or COLOR_WORDS.get(l["colorFamily"], l["colorFamily"])
    return (
        f"Professional photo of a manicure: {l['name']}. Technique: {l['technique']}. "
        f"Nail shape: {l['shape'].lower()}, length: {l['length']}. Finish: {l['finish']}. Colors/products: {shades}. "
        f"Styling and set: {l.get('photoBrief') or ''}. {STYLE}"
    )


def http(req: urllib.request.Request, timeout: int = 300) -> bytes:
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:500]
            if e.code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(10 * (attempt + 1)); continue
            raise RuntimeError(f"HTTP {e.code}: {body}") from None
    raise RuntimeError("unreachable")


def data_url(p: Path) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode()


def muse(prompt: str, key: str) -> list[bytes]:
    body = json.dumps({
        "prompt": prompt, "image_urls": [data_url(p) for p in REFS], "aspect_ratio": "4:3",
        "num_images": PER_MODEL, "output_format": "jpeg", "sync_mode": True,
    }).encode()
    req = urllib.request.Request("https://fal.run/meta/muse-image/edit", data=body, method="POST",
                                 headers={"Authorization": f"Key {key}", "Content-Type": "application/json"})
    out = json.loads(http(req))
    imgs = []
    for im in out.get("images", []):
        u = im["url"]
        if u.startswith("data:"):
            imgs.append(base64.b64decode(u.split(",", 1)[1]))
        else:
            imgs.append(http(urllib.request.Request(u)))
    return imgs


def openai(prompt: str, key: str, model: str) -> list[bytes]:
    boundary = uuid.uuid4().hex
    parts: list[bytes] = []
    def field(name: str, value: str):
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    for k, v in {"model": model, "prompt": prompt, "n": str(PER_MODEL), "size": "1536x1152",
                 "quality": "high", "output_format": "jpeg"}.items():
        field(k, v)
    for p in REFS:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="{p.name}"\r\n'
                     f"Content-Type: image/jpeg\r\n\r\n".encode() + p.read_bytes() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=b"".join(parts), method="POST",
                                 headers={"Authorization": f"Bearer {key}",
                                          "Content-Type": f"multipart/form-data; boundary={boundary}"})
    out = json.loads(http(req, timeout=600))
    return [base64.b64decode(d["b64_json"]) for d in out["data"]]


def main() -> int:
    looks = json.loads(LOOKS.read_text())
    want = set(sys.argv[1:])
    todo = [l for l in looks if (l["id"] in want) if want] if want else \
           [l for l in looks if not any((l.get("photoBySkinTone") or {}).values())]
    fal_key, oa_key = os.environ.get("FAL_KEY", "").strip(), os.environ.get("OPENAI_API_KEY", "").strip()
    if not (fal_key or oa_key):
        print("Neither FAL_KEY nor OPENAI_API_KEY is set.", file=sys.stderr); return 1
    OUT.mkdir(exist_ok=True)
    manifest: dict = {"openaiModel": OPENAI_MODEL, "looks": {}}
    oa_model = [OPENAI_MODEL]

    def run(look: dict, model: str):
        pr = prompt_for(look)
        if model == "muse":
            imgs = muse(pr, fal_key)
        else:
            try:
                imgs = openai(pr, oa_key, oa_model[0])
            except RuntimeError as e:
                if oa_model[0] != OPENAI_FALLBACK and ("model" in str(e).lower() or "400" in str(e)):
                    print(f"  {oa_model[0]} failed ({e}); falling back to {OPENAI_FALLBACK}")
                    oa_model[0] = OPENAI_FALLBACK
                    imgs = openai(pr, oa_key, OPENAI_FALLBACK)
                else:
                    raise
        d = OUT / look["id"]; d.mkdir(exist_ok=True)
        files = []
        for i, b in enumerate(imgs, 1):
            f = d / f"{model}-{i}.jpg"; f.write_bytes(b); files.append(str(f.relative_to(OUT)))
        return look["id"], model, files, pr

    jobs = [(l, m) for l in todo for m in (["muse"] if fal_key else []) + (["openai"] if oa_key else [])]
    errors = 0
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(run, l, m): (l["id"], m) for l, m in jobs}
        for fut in cf.as_completed(futs):
            lid, m = futs[fut]
            try:
                _, _, files, pr = fut.result()
                manifest["looks"].setdefault(lid, {"prompt": pr, "files": {}})["files"][m] = files
                print(f"  ok   {lid:36s} {m:6s} {len(files)} images")
            except Exception as e:
                errors += 1
                manifest["looks"].setdefault(lid, {"files": {}}).setdefault("errors", {})[m] = str(e)[:400]
                print(f"  FAIL {lid:36s} {m:6s} {e}", file=sys.stderr)
    manifest["openaiModel"] = oa_model[0]
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"Done: {len(jobs) - errors}/{len(jobs)} requests succeeded.")
    return 0 if errors < len(jobs) else 1


if __name__ == "__main__":
    sys.exit(main())
