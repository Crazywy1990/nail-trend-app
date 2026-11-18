"""One-time catalog expansion (services/discovery/seeds.json → 3 review PRs).

  python services/discovery/batch.py generate     draft every seed: spec (text model), photo,
                                                 AI review with one regeneration; near-duplicates
                                                 are dropped. Writes catalog-staging/ (looks,
                                                 photos, report) for the staging branch.
  python services/discovery/batch.py promote N    copy batch N from catalog-staging/ into the
                                                 catalog (looks.json, trend terms, API seed,
                                                 photos) and write the PR title/body.

The workflow opens batch 1 as a PR; when that PR is merged or closed, it opens the next one,
so the three PRs never conflict with each other.
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import os
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import discover as d  # noqa: E402
from discover import g, v  # noqa: E402

ROOT = d.ROOT
SEEDS = HERE / "seeds.json"
STAGING = ROOT / "catalog-staging"


def seed_prompt(seed: dict, terms_cfg: dict, looks: list[dict]) -> str:
    catalog = "\n".join(f"- {l['name']} ({l['technique']}; {l['finish']}, {l['colorFamily']})" for l in looks)
    ctx = f" for {seed['theme']}" if seed.get("theme") else f" for {seed['occasion']}" if seed.get("occasion") else ""
    return f"""Design ONE wearable, salon-realistic look{ctx} from this concept: "{seed['concept']}".
Keep: finish "{seed['finish']}", color family "{seed['colorFamily']}", shape "{seed['shape']}", length "{seed['length']}".
Do not duplicate any catalog look:
{catalog}

Return JSON with exactly these keys:
  name ("Main Idea · Detail" style), technique (one line a nail tech understands), system (one of {d.SYSTEMS}),
  priceRange (like "~$70", honest for a US salon), durationMin (integer, honest), stretchLevel (integer 1-5),
  occasions (1-3 of {d.OCCASIONS}), shades (1-3 objects {{"brand": string or null, "name": string}}; real product names
  only if you are sure they exist), photoBrief (one line: nails, jewelry, props and fabric for an editorial hand photo),
  terms (1-3 trend term ids from {list(terms_cfg['terms'])}, closest first)
"""


def draft_one(seed: dict, batch: str, terms_cfg: dict, catalog: list[dict], ids: set[str], key: str):
    raw = d.call_llm(seed_prompt(seed, terms_cfg, catalog), key)
    cand = [t for t in raw.get("terms", []) if t in terms_cfg["terms"]]
    term = cand[0] if cand else "french"
    for k in ("finish", "colorFamily", "shape", "length"):
        raw[k] = seed[k]  # the seed's attributes are the point of the slot
    look, terms = d.to_look(raw, term, terms_cfg, ids)
    look["draft"] = {"from": f"batch:{batch}", "created": look["draft"]["created"], "concept": seed["concept"]}
    fix, review, attempts, photo = "", None, 0, None
    while attempts < d.PHOTO_ATTEMPTS:
        attempts += 1
        photo = g.openai(g.prompt_for(look) + (f" Correction from review: {fix}" if fix else ""), key, g.OPENAI_MODEL)[0]
        review = v.verify_look(look, photo, catalog, key)
        print(f"  review {look['id']} attempt {attempts}: {review['verdict']} {review.get('scores')}")
        if review.get("near_duplicate") or review["verdict"] != "fail":
            break
        fix = review.get("photo_fix") or "; ".join(review.get("issues", [])[:3])
    return look, terms, photo, review, attempts


def generate() -> int:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        print("OPENAI_API_KEY is not set.", file=sys.stderr); return 1
    g.PER_MODEL = 1
    seeds = json.loads(SEEDS.read_text())["batches"]
    terms_cfg = json.loads(d.TERMS.read_text())
    catalog = json.loads(d.WEB_LOOKS.read_text())
    ids = {l["id"] for l in catalog}
    (STAGING / "photos").mkdir(parents=True, exist_ok=True)
    out = {"batches": {}, "dropped": []}
    jobs = [(b, s) for b, ss in seeds.items() for s in ss]
    with cf.ThreadPoolExecutor(max_workers=int(os.environ.get("BATCH_WORKERS", "4"))) as ex:
        futs = {ex.submit(draft_one, s, b, terms_cfg, catalog, ids, key): (b, s) for b, s in jobs}
        for f in cf.as_completed(futs):
            b, s = futs[f]
            try:
                look, terms, photo, review, attempts = f.result()
            except Exception as e:  # one failed seed shouldn't stop the batch
                print(f"  FAIL {s['concept'][:50]}: {e}", file=sys.stderr)
                out["dropped"].append({"concept": s["concept"], "why": str(e)[:200]}); continue
            if review.get("near_duplicate"):
                out["dropped"].append({"concept": s["concept"], "why": f"near-duplicate of {review.get('duplicate_of')}"}); continue
            while look["id"] in ids:
                look["id"] += "-2"
            ids.add(look["id"])
            look["photoBySkinTone"]["medium"] = f"/looks/{look['id']}.jpg"
            (STAGING / "photos" / f"{look['id']}.jpg").write_bytes(photo)
            out["batches"].setdefault(b, []).append({"look": look, "terms": terms, "review": review, "attempts": attempts})
            print(f"  ok   batch {b}: {look['id']}")
    (STAGING / "batch.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"Drafted {sum(len(x) for x in out['batches'].values())} looks; dropped {len(out['dropped'])}.")
    return 0


def promote(batch: str) -> int:
    from watermark import save_photo  # services/photos (on sys.path via discover)
    data = json.loads((STAGING / "batch.json").read_text())
    items = data["batches"].get(batch, [])
    if not items:
        print(f"Batch {batch} is empty; nothing to open.")
        return 0
    catalog = json.loads(d.WEB_LOOKS.read_text())
    terms_cfg = json.loads(d.TERMS.read_text())
    have = {l["id"] for l in catalog}
    added = []
    for it in items:
        l = it["look"]
        if l["id"] in have:
            continue
        save_photo((STAGING / "photos" / f"{l['id']}.jpg").read_bytes(), f"{l['id']}.jpg")
        catalog.append(l); added.append(it)
        terms_cfg["looks"][l["id"]] = it["terms"]
    d.WEB_LOOKS.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    d.TERMS.write_text(json.dumps(terms_cfg, indent=2, ensure_ascii=False) + "\n")
    if d.SEED_LOOKS.exists():
        seed = json.loads(d.SEED_LOOKS.read_text()) + [d.to_seed(it["look"]) for it in added]
        d.SEED_LOOKS.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n")
    repo, branch = os.environ.get("GITHUB_REPOSITORY", ""), os.environ.get("DRAFT_BRANCH", "")
    total = len(data["batches"])
    lines = [f"Catalog expansion, batch {batch} of {total}: {len(added)} new looks. Each was drafted from a gap in the catalog "
             "and checked by the separate AI reviewer (photo matches the spec, natural hand, realistic spec, not a duplicate). "
             "**Merge to approve** (they go live and get light/deep photos). To drop a look, delete it from "
             "`apps/web/lib/engine/looks.json` on this branch before merging. Merging or closing this PR opens the next batch.", ""]
    for it in added:
        l = it["look"]
        img = f"https://github.com/{repo}/blob/{branch}/apps/web/public/looks/{l['id']}.jpg?raw=true"
        shades = "; ".join((f"{s['brand']} " if s["brand"] else "") + s["name"] for s in l["shades"]) or "—"
        lines += [f"### {l['name']}", f"<img src=\"{img}\" width=\"420\">", "",
                  f"- **Fills:** {l['draft']['concept']}",
                  f"- **Technique:** {l['technique']}",
                  f"- {l['shape']} · {l['length']} · {l['system']} · {l['finish']} · {l['priceRange']} · {l['durationMin']} min · stretch {l['stretchLevel']}/5",
                  f"- **Shades (codes to verify):** {shades}",
                  f"- **Occasions:** {', '.join(l['occasions'])}",
                  v.report_md(l, it["review"], it["attempts"]), ""]
    if batch == "1" and data.get("dropped"):
        lines += ["#### Dropped before review", *[f"- {x['concept']}: {x['why']}" for x in data["dropped"]], ""]
    (ROOT / "pr-body.md").write_text("\n".join(lines))
    (ROOT / "pr-title.txt").write_text(f"New looks to review: catalog batch {batch} of {total} ({len(added)} looks)")
    return 0


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "generate":
        sys.exit(generate())
    if len(sys.argv) >= 3 and sys.argv[1] == "promote":
        sys.exit(promote(sys.argv[2]))
    print(__doc__); sys.exit(2)
