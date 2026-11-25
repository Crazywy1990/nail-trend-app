/**
 * AI pre-check for community uploads. Two OpenAI calls on a small copy of the photo:
 *  1. Moderation (free): sexual, violent, hateful or self-harm content, in the photo, caption or nickname.
 *  2. A cheap vision model: is it a manicure, is a face or personal info visible, is it sharp enough,
 *     and tags (color family, finish, shape, length) that feed the recommendations.
 * The AI never publishes anything: a "pass" still waits for the owner in /admin/posts. A clear "reject"
 * (unsafe, or no nails in it) is held back and shown to the uploader with the reason; the owner can still restore it.
 * Without OPENAI_API_KEY every upload goes to the owner unchecked.
 */
import type { AiCheck, PostTags } from "./store/community";

export const COLORS = ["blue", "brown", "green", "multi", "nude", "pink", "red", "white", "black", "purple", "orange", "yellow", "silver", "gold"] as const;
export const FINISHES = ["art", "cat-eye", "chrome", "french", "gloss", "jelly", "matte"] as const;
export const SHAPES = ["Almond", "Coffin", "Oval", "Round", "Square", "Squoval", "Stiletto"] as const;
export const LENGTHS = ["short", "medium", "long"] as const;

const KEY = () => process.env.OPENAI_API_KEY || "";
const BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const VISION_MODELS = (process.env.COMMUNITY_VISION_MODELS || "gpt-5-mini,gpt-4.1-mini").split(",").map((s) => s.trim()).filter(Boolean);

const PROMPT = `You check photos people upload to a nail-design community app before a human moderator sees them.
Look at the photo and answer in JSON only:
{
 "is_manicure": true if the main subject is a person's finished manicure or pedicure (nails clearly visible), else false,
 "face_visible": true if a person's face is recognizable,
 "personal_info": true if readable personal info is visible (phone number, address, ID card, credit card, license plate, full name on a document),
 "other_brand_watermark": true if another account's watermark, logo or @handle is printed on the photo (likely not their own photo),
 "sharpness": 1-5 (1 = too blurry or dark to see the nails, 5 = crisp),
 "colorFamily": one of ${COLORS.join(", ")} (the dominant nail color; "multi" for several colors),
 "finish": one of ${FINISHES.join(", ")} ("art" for hand-painted designs, charms or 3D; "gloss" for a plain glossy color),
 "shape": one of ${SHAPES.join(", ")},
 "length": one of ${LENGTHS.join(", ")},
 "words": 2-5 short lowercase descriptors a person would search for (e.g. "milky", "gold flake", "hearts", "aura"),
 "summary": one short sentence describing the set
}`;

type Vision = {
  is_manicure?: boolean; face_visible?: boolean; personal_info?: boolean; other_brand_watermark?: boolean;
  sharpness?: number; colorFamily?: string; finish?: string; shape?: string; length?: string; words?: string[]; summary?: string;
};

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => {
  const s = String(v ?? "");
  return (allowed.find((a) => a.toLowerCase() === s.toLowerCase()) as T) ?? null;
};

async function openai(path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function moderate(dataUrl: string, text: string): Promise<{ flagged: boolean; categories: string[] }> {
  const r = await openai("moderations", {
    model: "omni-moderation-latest",
    input: [{ type: "text", text: text || "(no text)" }, { type: "image_url", image_url: { url: dataUrl } }],
  });
  const results = (r.results as { flagged: boolean; categories: Record<string, boolean> }[]) || [];
  const categories = results.flatMap((x) => Object.entries(x.categories || {}).filter(([, v]) => v).map(([k]) => k));
  return { flagged: results.some((x) => x.flagged), categories: [...new Set(categories)] };
}

async function look(dataUrl: string): Promise<{ v: Vision; model: string }> {
  let last: unknown;
  for (const model of VISION_MODELS) {
    const body: Record<string, unknown> = {
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: dataUrl, detail: "low" } }] }],
    };
    if (model.startsWith("gpt-5")) body.reasoning_effort = "minimal";
    try {
      const r = await openai("chat/completions", body);
      const content = ((r.choices as { message: { content: string } }[])?.[0]?.message?.content) || "{}";
      return { v: JSON.parse(content) as Vision, model };
    } catch (e) {
      last = e;
      console.error(`[allten] vision check with ${model} failed`, e);
    }
  }
  throw last ?? new Error("no vision model");
}

export async function checkUpload(small: Buffer, text: string): Promise<{ ai: AiCheck; tags: PostTags }> {
  const empty: PostTags = { colorFamily: null, finish: null, shape: null, length: null, words: [] };
  if (!KEY()) {
    return { ai: { checked: false, verdict: "review", reason: null, notes: ["AI check off (no OPENAI_API_KEY)"] }, tags: empty };
  }
  const dataUrl = `data:image/jpeg;base64,${small.toString("base64")}`;
  const [mod, vis] = await Promise.allSettled([moderate(dataUrl, text), look(dataUrl)]);
  const notes: string[] = [];
  let verdict: AiCheck["verdict"] = "pass";
  let reason: string | null = null;
  let model: string | undefined;
  let tags = empty;

  if (mod.status === "fulfilled") {
    if (mod.value.flagged) {
      verdict = "reject";
      reason = "This photo or text doesn't meet our community guidelines.";
      notes.push(`moderation: ${mod.value.categories.join(", ") || "flagged"}`);
    }
  } else {
    verdict = "review";
    notes.push("moderation check failed");
  }

  if (vis.status === "fulfilled") {
    const v = vis.value.v;
    model = vis.value.model;
    tags = {
      colorFamily: pick(v.colorFamily, COLORS), finish: pick(v.finish, FINISHES),
      shape: pick(v.shape, SHAPES), length: pick(v.length, LENGTHS),
      words: (Array.isArray(v.words) ? v.words : []).map((w) => String(w).toLowerCase().trim().slice(0, 24)).filter(Boolean).slice(0, 5),
    };
    if (v.summary) notes.push(`AI: ${String(v.summary).slice(0, 160)}`);
    if (v.is_manicure === false && verdict !== "reject") {
      verdict = "reject";
      reason = "We couldn't see a manicure in this photo. Try a close, well-lit shot of your nails.";
    }
    if (verdict === "pass") {
      if (v.face_visible) { verdict = "review"; notes.push("face visible"); }
      if (v.personal_info) { verdict = "review"; notes.push("personal info visible"); }
      if (v.other_brand_watermark) { verdict = "review"; notes.push("someone else's watermark or handle on the photo"); }
      if ((v.sharpness ?? 5) <= 2) { verdict = "review"; notes.push(`sharpness ${v.sharpness}/5`); }
    }
  } else if (verdict === "pass") {
    verdict = "review";
    notes.push("vision check failed");
  }
  return { ai: { checked: true, verdict, reason, notes, model }, tags };
}

/** Nickname: 2–20 letters, numbers, spaces, . _ -; no links or contact details. */
export function cleanNickname(raw: string): string | null {
  const s = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 20) return null;
  if (!/^[\p{L}\p{N} ._-]+$/u.test(s)) return null;
  if (/(https?|www\.|\.com|\d{6,})/i.test(s)) return null;
  return s;
}

/** Text-only moderation for comments and reviews (free endpoint). "unchecked" when there's no key or the call fails. */
export async function checkText(text: string): Promise<"ok" | "flagged" | "unchecked"> {
  if (!KEY()) return "unchecked";
  try {
    const r = await openai("moderations", { model: "omni-moderation-latest", input: text });
    const results = (r.results as { flagged: boolean }[]) || [];
    return results.some((x) => x.flagged) ? "flagged" : "ok";
  } catch (e) {
    console.error("[allten] text moderation failed", e);
    return "unchecked";
  }
}

/** Image-only moderation for profile photos and covers (free endpoint). */
export async function checkImage(small: Buffer): Promise<"ok" | "flagged" | "unchecked"> {
  if (!KEY()) return "unchecked";
  try {
    const r = await moderate(`data:image/jpeg;base64,${small.toString("base64")}`, "");
    return r.flagged ? "flagged" : "ok";
  } catch (e) {
    console.error("[allten] image moderation failed", e);
    return "unchecked";
  }
}
