import type { Look, Shade, Slot } from "./types";

export function metaLine(l: Look): string {
  return `${l.shape} · ${l.length} · ${l.system} · ${l.priceRange} · ${l.durationMin} min`;
}

/** How far outside her usual set a look is, in client words (stretch 1–5). */
export function wearLabel(l: Look): string {
  return l.stretchLevel <= 2 ? "Easy to wear" : l.stretchLevel === 3 ? "A little new" : "Bold";
}
/** Quick-glance facts shown as chips on cards: price, time, how easy it is to wear. */
export function factChips(l: Look): string[] {
  return [l.priceRange, `${l.durationMin} min`, wearLabel(l)];
}
/** Meta line without price/time (those are chips). */
export function styleLine(l: Look): string {
  const len = l.length.charAt(0).toUpperCase() + l.length.slice(1);
  return `${l.shape} · ${len} · ${l.system}`;
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

/** Soft background for looks whose photo isn't in yet, keyed by color family. */
const TINTS: Record<string, [string, string]> = {
  red: ["#7a1f2b", "#c2525e"], green: ["#1f5a45", "#5f9c84"], pink: ["#e6b7bd", "#f6e1e3"],
  brown: ["#5b3a2c", "#a77b63"], nude: ["#d9b9a3", "#f2e3d7"], white: ["#e8e1d8", "#faf7f2"],
  blue: ["#1d4f5c", "#5e95a1"], multi: ["#7a1f2b", "#1f5a45"],
};
export function tintFor(colorFamily: string): string {
  const [a, b] = TINTS[colorFamily] ?? ["#e9d8cc", "#f7efe8"];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}
export const isDarkTint = (colorFamily: string) => ["red", "green", "brown", "blue", "multi"].includes(colorFamily);
