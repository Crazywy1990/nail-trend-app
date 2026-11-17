"""AllTen watermark for every look photo the website serves.

Clean originals live in assets/looks/ (not served; used as references for skin-tone edits
and for the AI reviewer). The website serves watermarked copies in apps/web/public/looks/.

  python services/photos/watermark.py          re-stamp every original into public/
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ORIGINALS = ROOT / "assets/looks"
PUBLIC = ROOT / "apps/web/public/looks"
FONTS = Path(__file__).resolve().parent / "fonts"
# Photos not made by our image pipeline: wordmark only, no "AI-generated" line.
NOT_AI = {"burgundy-cat-eye.jpg", "emerald-chrome.jpg"}


def stamp(im: Image.Image, ai: bool = True) -> Image.Image:
    """Bottom-right 'AllTen' wordmark with a small 'AI-generated image' line, white at ~70% with a soft shadow."""
    im = im.convert("RGB")
    w, h = im.size
    big = ImageFont.truetype(str(FONTS / "DejaVuSans-Bold.ttf"), max(14, int(w * 0.034)))
    small = ImageFont.truetype(str(FONTS / "DejaVuSans.ttf"), max(9, int(w * 0.0135)))
    t1, t2 = "AllTen", ("AI-generated image" if ai else " ")
    b1 = big.getbbox(t1); b2 = small.getbbox(t2)
    w1, h1 = b1[2] - b1[0], b1[3] - b1[1]
    w2, h2 = b2[2] - b2[0], b2[3] - b2[1]
    m = int(w * 0.025)
    x1, y2 = w - m - w1, h - m - h2
    x2, y1 = w - m - w2, y2 - int(h1 * 0.45) - h1

    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ds = ImageDraw.Draw(shadow)
    for (x, y, t, f) in ((x1, y1 - b1[1], t1, big), (x2, y2 - b2[1], t2, small)):
        ds.text((x, y), t, font=f, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, w // 400)))
    d = ImageDraw.Draw(layer)
    d.text((x1, y1 - b1[1]), t1, font=big, fill=(255, 255, 255, 185))
    d.text((x2, y2 - b2[1]), t2, font=small, fill=(255, 255, 255, 170))
    out = Image.alpha_composite(Image.alpha_composite(im.convert("RGBA"), shadow), layer)
    return out.convert("RGB")


def save_photo(raw: bytes, name: str) -> None:
    """Store the clean original and publish the watermarked copy under the same file name."""
    ORIGINALS.mkdir(parents=True, exist_ok=True)
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    im.save(ORIGINALS / name, quality=88, optimize=True, progressive=True)
    stamp(im, ai=name not in NOT_AI).save(PUBLIC / name, quality=84, optimize=True, progressive=True)


def restamp_all() -> int:
    n = 0
    for p in sorted(ORIGINALS.glob("*.jpg")):
        stamp(Image.open(p), ai=p.name not in NOT_AI).save(PUBLIC / p.name, quality=84, optimize=True, progressive=True)
        n += 1
    return n


if __name__ == "__main__":
    print(f"Stamped {restamp_all()} photos.")
    sys.exit(0)
