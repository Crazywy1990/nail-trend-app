// Mirrors services/api/app/schemas.py (camelCase over the wire).

export type Shade = { brand: string | null; name: string; code: string | null; verified: boolean };
export type TrendProof = { text: string | null; isPlaceholder: boolean };
/** A real client's photo of this look, shown as "Asked for → Got". */
export type ResultPhoto = { src: string; alt: string; caption?: string | null };

export type Look = {
  id: string;
  name: string;
  technique: string;
  system: string; // gel | builder gel | Gel-X — shown in the meta line
  finish: string; // chrome | cat-eye | french | matte | jelly | gloss | art — diversity + chips
  colorFamily: string;
  shape: string;
  length: string;
  priceRange: string;
  durationMin: number;
  stretchLevel: number;
  fitPrior: number;
  trendVelocity: number;
  trendSources: string[];
  trendProof: TrendProof;
  /** Provenance of the displayed stat, e.g. "YouTube · share of new nail videos · week of Nov 16". */
  trendSource?: string | null;
  /** Date (YYYY-MM-DD) the stat was pulled. */
  trendAsOf?: string | null;
  /** True when the stat has no provenance or is older than 14 days: hidden on the site. */
  trendIsPlaceholder?: boolean;
  /** The stat as data (term, growth, counts), for analysis and the share card. */
  trendValue?: Record<string, unknown> | null;
  /** Weekly drop this look belongs to; inactive looks are retired, not deleted. */
  dropId?: string;
  dropDate?: string;
  active?: boolean;
  /** Tech/salon slugs that can book exactly this look (lib/engine/techs.json). */
  bookableBy?: string[];
  resultPhoto?: ResultPhoto | null;
  /** "generated" (our AI image pipeline), "edited" (an original, AI-retouched) or "original". */
  photoSource?: "generated" | "edited" | "original";
  /** Card badge from the trend pipeline ("↑ Rising" or "↓ Cooling"); null when steady; absent on sample data. */
  trendBadge?: string | null;
  shades: Shade[];
  photoBySkinTone: Record<string, string | null>;
  photoPos: string;
  photoAlt: string | null;
  photoBrief: string | null;
  occasions: string[];
  why: string | null;
};

export type Slot = "for_you" | "trending" | "stretch";

export type Pick = {
  look: Look;
  slot: Slot;
  position: number;
  relevance: number;
  photo: string | null;
  why: string;
};

export type DiscoverResponse = {
  setId: string;
  rankingVersion: string;
  filters: { occasion: string[]; finish: string[]; length: string[]; color?: string[]; vibe?: "subtle" | "bold" | null; theme?: string | null; themeExplicit?: boolean };
  cards: Pick[];
  also: Pick[];
  summary: string;
  /** What the filters and "Describe it" text were read as, e.g. ["Holiday party", "Short", "Subtle"]. */
  understood?: string[];
  exactMatch?: boolean;
};

export type EventType =
  | "impression" | "save" | "unsave" | "reject" | "too_bold"
  | "book_click" | "share_click" | "landing" | "look_view" | "share_tap" | "booking_request" | "tone_switch";
