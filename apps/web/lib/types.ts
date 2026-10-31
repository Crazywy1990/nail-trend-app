// Mirrors services/api/app/schemas.py (camelCase over the wire).

export type Shade = { brand: string | null; name: string; code: string | null; verified: boolean };
export type TrendProof = { text: string | null; isPlaceholder: boolean };

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
  filters: { occasion: string[]; finish: string[]; length: string[] };
  cards: Pick[];
  also: Pick[];
  summary: string;
};

export type EventType =
  | "impression" | "save" | "unsave" | "reject" | "too_bold"
  | "book_click" | "share_click" | "landing";
