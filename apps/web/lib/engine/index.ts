/**
 * Built-in recommendation engine: a TypeScript port of services/api/app/ranking.py,
 * so the web app works on Vercel alone. Same rules, same results:
 *   6 personalized-safe + 1 trending + 1 stretch.
 *   Relevance decides eligibility; MMR (λ = 0.7) with caps of 2 per color family and
 *   3 per finish decides the set, penalizing near-duplicates of her current set.
 * The Python service remains the home of the trend pipeline; set USE_REMOTE_API=1 to use it.
 */
import type { DiscoverResponse, Look, Pick, Slot } from "../types";
import raw from "./looks.json";
import trends from "./trends.json";

export const RANKING_VERSION = "mmr-v1";
const LAMBDA = 0.7;
const SAFE_MIN = 0.6;
const STRETCH_MIN = 0.42;
const MAX_PER_COLOR = 2;
const MAX_PER_FINISH = 3;
const SAFE_COUNT = 6;
const OCCASION_BOOST = 0.08;

type TrendRow = { text: string; isPlaceholder: boolean; badge: string | null; velocity: number; sources: string[] };
/** Written weekly by services/pipeline. Looks without a row keep their sample trend data. */
const TRENDS = trends as unknown as { generatedAt: string | null; looks: Record<string, TrendRow> };
export const TRENDS_UPDATED = TRENDS.generatedAt;

export const LOOKS = (raw as unknown as Look[]).map((l): Look => {
  const t = TRENDS.looks[l.id];
  if (!t) return l;
  return {
    ...l,
    trendProof: { text: t.text, isPlaceholder: t.isPlaceholder },
    trendBadge: t.badge,
    trendVelocity: t.velocity,
    trendSources: t.sources,
  };
});

export type Profile = {
  userId: string;
  skinTone: "light" | "medium" | "deep";
  undertone: "warm" | "cool" | "neutral";
  jewelryMetal: "gold" | "silver" | "mixed";
  current: { colorFamily: string; finish: string } | null;
  affinity: Record<string, number>;
  maxStretch: number;
};

export const DEMO_PROFILE: Omit<Profile, "userId"> = {
  skinTone: "medium",
  undertone: "warm",
  jewelryMetal: "gold",
  current: { colorFamily: "pink", finish: "jelly" },
  affinity: {},
  maxStretch: 5,
};

export type Filters = { occasion: string[]; finish: string[]; length: string[] };

const attrKeys = (l: Look) => [
  `color:${l.colorFamily}`, `finish:${l.finish}`, `shape:${l.shape.toLowerCase()}`, `length:${l.length}`,
];

export function relevance(l: Look, p: Profile, f: Filters): number {
  const attrs = attrKeys(l).map((k) => p.affinity[k] ?? 0.5);
  let s = 0.6 * l.fitPrior + 0.4 * (attrs.reduce((a, b) => a + b, 0) / attrs.length);
  if (f.occasion.length && f.occasion.some((o) => l.occasions.includes(o))) s += OCCASION_BOOST;
  return Math.max(0, Math.min(1, s));
}

const sim = (ac: string, af: string, bc: string, bf: string) => (ac === bc ? 0.6 : 0) + (af === bf ? 0.4 : 0);

function mmrPick(cands: Look[], picked: Look[], p: Profile, rel: Map<string, number>): Look | null {
  const anchors = picked.map((x) => [x.colorFamily, x.finish] as const);
  if (p.current) anchors.push([p.current.colorFamily, p.current.finish]);
  let best: Look | null = null;
  let bestScore = -Infinity;
  for (const l of cands) {
    if (picked.includes(l)) continue;
    if (picked.filter((x) => x.colorFamily === l.colorFamily).length >= MAX_PER_COLOR) continue;
    if (picked.filter((x) => x.finish === l.finish).length >= MAX_PER_FINISH) continue;
    const maxSim = anchors.reduce((m, [c, f]) => Math.max(m, sim(l.colorFamily, l.finish, c, f)), 0);
    const score = LAMBDA * rel.get(l.id)! - (1 - LAMBDA) * maxSim;
    if (score > bestScore) { bestScore = score; best = l; }
  }
  return best;
}

const matchesHard = (l: Look, f: Filters) =>
  (!f.finish.length || f.finish.includes(l.finish)) && (!f.length.length || f.length.includes(l.length));

export function selectSet(pool: Look[], p: Profile, f: Filters) {
  const rel = new Map(pool.map((l) => [l.id, relevance(l, p, f)]));
  const lo = Math.min(4, p.maxStretch);
  const stretch = pool
    .filter((l) => l.stretchLevel >= lo && l.stretchLevel <= p.maxStretch && rel.get(l.id)! >= STRETCH_MIN)
    .reduce<Look | null>((b, l) => (!b || rel.get(l.id)! + l.trendVelocity > rel.get(b.id)! + b.trendVelocity ? l : b), null);

  const safeAll = pool.filter((l) => l !== stretch && l.stretchLevel <= 3 && rel.get(l.id)! >= SAFE_MIN);
  const safeFiltered = safeAll.filter((l) => matchesHard(l, f));
  const primary = safeFiltered.length ? safeFiltered : safeAll;

  const safe: Look[] = [];
  const hero = mmrPick(primary, safe, p, rel);
  if (hero) safe.push(hero);

  const trending = pool
    .filter((l) => l !== stretch && !safe.includes(l) && l.stretchLevel <= 3 && rel.get(l.id)! >= STRETCH_MIN)
    .reduce<Look | null>((b, l) => (!b || l.trendVelocity > b.trendVelocity ? l : b), null);

  const picked = trending ? [...safe, trending] : [...safe];
  for (const source of [primary, safeAll]) {
    while (safe.length < SAFE_COUNT) {
      const next = mmrPick(source.filter((l) => l !== trending), picked, p, rel);
      if (!next) break;
      safe.push(next);
      picked.push(next);
    }
  }
  return { safe, trending, stretch, rel };
}

// ---- "Describe it" keyword parsing (same rules as the Python service) ----
const OCCASION_WORDS: Record<string, string> = {
  work: "work", office: "work", meeting: "work", interview: "work",
  wedding: "wedding", bridal: "wedding",
  vacation: "vacation", beach: "vacation", trip: "vacation", pool: "vacation",
  date: "date night", dinner: "date night",
  party: "holiday party", holiday: "holiday party", christmas: "holiday party",
  "new year": "holiday party", halloween: "party",
};
const FINISH_WORDS: Record<string, string> = {
  chrome: "chrome", "cat-eye": "cat-eye", "cat eye": "cat-eye", magnetic: "cat-eye",
  french: "french", matte: "matte", jelly: "jelly", glossy: "gloss", gloss: "gloss",
};
const LENGTH_WORDS: Record<string, string> = { short: "short", medium: "medium", long: "long" };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function found(text: string, table: Record<string, string>): string[] {
  const t = text.toLowerCase();
  return [...new Set(Object.entries(table).filter(([k]) => new RegExp(`\\b${esc(k)}\\b`).test(t)).map(([, v]) => v))];
}
export function parseNeed(text: string): Filters {
  return { occasion: found(text, OCCASION_WORDS), finish: found(text, FINISH_WORDS), length: found(text, LENGTH_WORDS) };
}

function whyFor(l: Look, p: Profile, f: Filters): string {
  if (l.why) return l.why;
  const occ = f.occasion.find((o) => l.occasions.includes(o)) || l.occasions[0] || "everyday";
  return `Picked for you: a ${l.length} ${l.shape.toLowerCase()} ${l.finish} set that fits ${occ} and pairs with your ${p.jewelryMetal} jewelry. Stretch ${l.stretchLevel} of 5.`;
}

const uniq = (a: string[]) => [...new Set(a)];

export function discover(userId: string, q: string, chips: Filters): DiscoverResponse {
  const parsed = parseNeed(q || "");
  const f: Filters = {
    occasion: uniq([...chips.occasion, ...parsed.occasion]),
    finish: uniq([...chips.finish, ...parsed.finish]),
    length: uniq([...chips.length, ...parsed.length]),
  };
  const p: Profile = { userId, ...DEMO_PROFILE };
  const r = selectSet(LOOKS, p, f);
  const pick = (l: Look, slot: Slot, position: number): Pick => ({
    look: l, slot, position,
    relevance: Math.round(r.rel.get(l.id)! * 1000) / 1000,
    photo: l.photoBySkinTone?.[p.skinTone] ?? null,
    why: whyFor(l, p, f),
  });
  const [hero, ...rest] = r.safe;
  const cards = [pick(hero, "for_you", 0), ...(r.stretch ? [pick(r.stretch, "stretch", 1)] : [])];
  const also = rest.map((l, i) => pick(l, "for_you", i + 2));
  if (r.trending) also.push(pick(r.trending, "trending", also.length + 2));
  return {
    setId: Math.random().toString(36).slice(2) + Date.now().toString(36),
    rankingVersion: RANKING_VERSION,
    filters: f,
    cards,
    also,
    summary: `${r.safe.length} for you · ${r.trending ? 1 : 0} trending · ${r.stretch ? 1 : 0} stretch`,
  };
}

export function getLook(id: string): Look | null {
  return LOOKS.find((l) => l.id === id) ?? null;
}
