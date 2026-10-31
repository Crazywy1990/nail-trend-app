import type { Look, Shade, Slot } from "./types";

export function metaLine(l: Look): string {
  return `${l.shape} · ${l.length} · ${l.system} · ${l.priceRange} · ${l.durationMin} min`;
}

/** Unverified codes are never printed as fact. */
export function shadeLabel(s: Shade): string {
  const code = !s.code ? "" : s.verified ? ` (${s.code})` : " (code to verify)";
  return `${s.brand ? s.brand + " " : ""}${s.name}${code}`;
}

export function specLine(l: Look): string {
  const shades = l.shades.map(shadeLabel);
  return [...shades, `${l.shape.toLowerCase()}, ${l.length}`].join(" · ");
}

export function slotLabel(slot: Slot, l: Look): string {
  if (slot === "stretch") return `Stretch pick · ${l.stretchLevel} of 5`;
  if (slot === "trending") return "Trending pick";
  return "For you";
}

export function photoFor(l: Look, skinTone = "medium"): string | null {
  return l.photoBySkinTone?.[skinTone] ?? null;
}
