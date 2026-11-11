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
import themesRaw from "./themes.json";

export const RANKING_VERSION = "mmr-v1";
const LAMBDA = 0.7;
const SAFE_MIN = 0.6;
const STRETCH_MIN = 0.42;
const MAX_PER_COLOR = 2;
const MAX_PER_FINISH = 3;
const SAFE_COUNT = 6;
const OCCASION_BOOST = 0.08;
const THEME_BOOST = 0.25;        // a theme she typed or tapped
const SEASON_BOOST = 0.1;        // the theme of today's date, on the default feed

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

export type Filters = {
  occasion: string[]; finish: string[]; length: string[];
  color?: string[];
  /** From "Describe it": "subtle" keeps to stretch ≤ 2, "bold" to stretch ≥ 3. */
  vibe?: "subtle" | "bold" | null;
  /** Theme id (themes.json). Explicit = she asked for it (filters + strong boost); otherwise a light seasonal lean. */
  theme?: string | null;
  themeExplicit?: boolean;
};

// ---- Themes (shared with services/discovery via themes.json) ----
export type Theme = { label: string; words: string[]; colors: string[]; finishes: string[]; window: [string, string]; leadDays: number; brief: string };
export const THEMES = (themesRaw as unknown as { themes: Record<string, Theme> }).themes;

/** 0..1. A look belongs to a theme when its color is in the palette (0.7); a palette finish adds 0.3. */
export function themeScore(l: Look, themeId: string | null | undefined): number {
  const t = themeId ? THEMES[themeId] : undefined;
  if (!t || !t.colors.includes(l.colorFamily)) return 0;
  return 0.7 + (t.finishes.includes(l.finish) ? 0.3 : 0);
}

const mmdd = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inWindow = (md: string, [a, b]: [string, string]) => (a <= b ? md >= a && md <= b : md >= a || md <= b);
/** The theme whose window contains this date (the default feed leans toward it). */
export function themeForDate(d: Date): string | null {
  const md = mmdd(d);
  return Object.entries(THEMES).find(([, t]) => inWindow(md, t.window))?.[0] ?? null;
}

const attrKeys = (l: Look) => [
  `color:${l.colorFamily}`, `finish:${l.finish}`, `shape:${l.shape.toLowerCase()}`, `length:${l.length}`,
];

export function relevance(l: Look, p: Profile, f: Filters): number {
  const attrs = attrKeys(l).map((k) => p.affinity[k] ?? 0.5);
  let s = 0.6 * l.fitPrior + 0.4 * (attrs.reduce((a, b) => a + b, 0) / attrs.length);
  if (f.occasion.length && f.occasion.some((o) => l.occasions.includes(o))) s += OCCASION_BOOST;
  if (f.theme) s += (f.themeExplicit ? THEME_BOOST : SEASON_BOOST) * themeScore(l, f.theme);
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

/**
 * Filtered mode: every matching look is shown, ordered by MMR (relevance vs variety).
 * The stretch card is the best matching look above her comfort zone, if any; the
 * trending row is the matching look with the highest trend velocity among the rest.
 */
export function selectFiltered(pool: Look[], p: Profile, f: Filters) {
  const rel = new Map(pool.map((l) => [l.id, relevance(l, p, f)]));
  // A stretch card only when something else can lead the set.
  const stretch = pool.length < 2 ? null : pool
    .filter((l) => l.stretchLevel >= 4 && l.stretchLevel <= p.maxStretch)
    .reduce<Look | null>((b, l) => (!b || rel.get(l.id)! > rel.get(b.id)! ? l : b), null);
  const rest = pool.filter((l) => l !== stretch);
  const ordered: Look[] = [];
  while (ordered.length < rest.length) {
    // relax the per-color / per-finish caps: with filters on, she asked for this
    let best: Look | null = null, bestScore = -Infinity;
    const anchors = ordered.map((x) => [x.colorFamily, x.finish] as const);
    for (const l of rest) {
      if (ordered.includes(l)) continue;
      const maxSim = anchors.reduce((m, [c, fi]) => Math.max(m, sim(l.colorFamily, l.finish, c, fi)), 0);
      const score = LAMBDA * rel.get(l.id)! - (1 - LAMBDA) * maxSim;
      if (score > bestScore) { bestScore = score; best = l; }
    }
    ordered.push(best!);
  }
  const safe = ordered.slice(0, 1 + 6);
  let trending: Look | null = null;
  if (safe.length > 2) {
    trending = safe.slice(1).reduce((b, l) => (l.trendVelocity > b.trendVelocity ? l : b));
    safe.splice(safe.indexOf(trending), 1);
  }
  return { safe, trending, stretch, rel };
}

// ---- "Describe it" keyword parsing (same rules as the Python service) ----
const OCCASION_WORDS: Record<string, string> = {
  work: "work", office: "work", meeting: "work", interview: "work",
  wedding: "wedding", bridal: "wedding",
  vacation: "vacation", beach: "vacation", trip: "vacation", pool: "vacation",
  date: "date night", dinner: "date night",
  party: "holiday party", gala: "holiday party",
  everyday: "work", daily: "work", school: "work", brunch: "date night", honeymoon: "vacation",
};
const COLOR_WORDS: Record<string, string> = {
  red: "red", cherry: "red", burgundy: "red", wine: "red", oxblood: "red", maroon: "red",
  green: "green", emerald: "green", olive: "green",
  pink: "pink", rose: "pink", blush: "pink",
  brown: "brown", chocolate: "brown", mocha: "brown", espresso: "brown", tortoise: "brown", tortoiseshell: "brown",
  nude: "nude", neutral: "nude", beige: "nude",
  white: "white", milky: "white", pearl: "white",
  blue: "blue", teal: "blue", navy: "blue",
  colorful: "multi", rainbow: "multi", mismatched: "multi",
};
const SUBTLE = /\b(not (too |so |very )?(flashy|loud|bold|much)|subtle|minimal|minimalist|understated|clean|classy|natural|simple|quiet|low[- ]key)\b/;
const BOLD = /\b(bold|statement|loud|fun|flashy|wild|dramatic|eye[- ]catching)\b/;
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
function findTheme(text: string): string | null {
  const t = text.toLowerCase();
  for (const [id, th] of Object.entries(THEMES)) {
    if (th.words.some((w) => new RegExp(`\\b${esc(w)}\\b`).test(t))) return id;
  }
  return null;
}

export function parseNeed(text: string): Filters {
  const t = text.toLowerCase();
  const vibe = SUBTLE.test(t) ? "subtle" : BOLD.test(t) ? "bold" : null;
  const theme = findTheme(text);
  return {
    occasion: found(text, OCCASION_WORDS), finish: found(text, FINISH_WORDS), length: found(text, LENGTH_WORDS),
    color: found(text, COLOR_WORDS), vibe, theme, themeExplicit: !!theme,
  };
}

/** A look matches when it satisfies every filter group the client set (any value within a group). */
export function matchesAll(l: Look, f: Filters): boolean {
  const any = (vals: string[] | undefined, ok: (v: string) => boolean) => !vals?.length || vals.some(ok);
  return any(f.occasion, (o) => l.occasions.includes(o))
    && any(f.finish, (v) => l.finish === v)
    && any(f.length, (v) => l.length === v)
    && any(f.color, (v) => l.colorFamily === v)
    && (f.vibe !== "subtle" || l.stretchLevel <= 2)
    && (f.vibe !== "bold" || l.stretchLevel >= 3)
    && (!f.themeExplicit || themeScore(l, f.theme) > 0);
}

const hasFilters = (f: Filters) =>
  !!(f.occasion.length || f.finish.length || f.length.length || f.color?.length || f.vibe || f.themeExplicit);

const LABELS: Record<string, string> = { "date night": "Date night", "holiday party": "Holiday party", "cat-eye": "Cat-eye" };
const cap = (v: string) => LABELS[v] ?? v.charAt(0).toUpperCase() + v.slice(1);
export function describeFilters(f: Filters): string[] {
  return [
    ...(f.themeExplicit && f.theme && THEMES[f.theme] ? [THEMES[f.theme].label] : []),
    ...f.occasion.map(cap), ...f.finish.map(cap), ...f.length.map(cap),
    ...(f.color ?? []).map((c) => (c === "multi" ? "Multicolor" : cap(c))),
    ...(f.vibe ? [cap(f.vibe)] : []),
  ];
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
    color: uniq([...(chips.color ?? []), ...(parsed.color ?? [])]),
    vibe: chips.vibe ?? parsed.vibe ?? null,
  };
  // A theme she typed or tapped wins; otherwise the default feed leans toward today's season.
  const explicitTheme = (chips.theme && THEMES[chips.theme] ? chips.theme : null) ?? parsed.theme ?? null;
  f.theme = explicitTheme ?? themeForDate(new Date());
  f.themeExplicit = !!explicitTheme;
  const p: Profile = { userId, ...DEMO_PROFILE };
  // With filters set, the set is built only from looks that match all of them.
  // If nothing matches, fall back to the closest looks and say so.
  const filtered = hasFilters(f);
  const matching = filtered ? LOOKS.filter((l) => matchesAll(l, f)) : LOOKS;
  const exact = matching.length > 0;
  const pool = exact ? matching : LOOKS;
  const r = filtered && exact ? selectFiltered(pool, p, f) : selectSet(pool, p, f);
  const seasonal = !f.themeExplicit && f.theme ? THEMES[f.theme]?.label ?? null : null;
  const pick = (l: Look, slot: Slot, position: number): Pick => ({
    look: l, slot, position,
    relevance: Math.round(r.rel.get(l.id)! * 1000) / 1000,
    photo: l.photoBySkinTone?.[p.skinTone] ?? null,
    why: whyFor(l, p, f),
  });
  const [hero, ...rest] = r.safe;
  const cards = hero ? [pick(hero, "for_you", 0), ...(r.stretch ? [pick(r.stretch, "stretch", 1)] : [])] : [];
  const also = rest.map((l, i) => pick(l, "for_you", i + 2));
  if (r.trending) also.push(pick(r.trending, "trending", also.length + 2));
  return {
    setId: Math.random().toString(36).slice(2) + Date.now().toString(36),
    rankingVersion: RANKING_VERSION,
    filters: f,
    cards,
    also,
    summary: !filtered
      ? `${r.safe.length} for you · ${r.trending ? 1 : 0} trending · ${r.stretch ? 1 : 0} stretch${seasonal ? ` · leaning ${seasonal}` : ""}`
      : exact
        ? `${matching.length} of ${LOOKS.length} looks match`
        : "No exact match yet · showing the closest looks",
    understood: describeFilters(f),
    exactMatch: !filtered || exact,
  };
}

export function getLook(id: string): Look | null {
  return LOOKS.find((l) => l.id === id) ?? null;
}
