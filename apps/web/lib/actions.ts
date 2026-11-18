"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PAIRS } from "./onboarding";
import { TIME_WINDOWS } from "./timeWindows";
import { DEFAULT_PROFILE, createBookingRequest, getProfile, recordEvent, saveProfile, type UserProfile } from "./store";

const uidOf = () => cookies().get("uid")?.value || "anon";
const one = <T extends string>(v: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(String(v)) ? (String(v) as T) : fallback;


/** Onboarding / edit profile form. */
export async function submitOnboarding(form: FormData) {
  const uid = uidOf();
  const prev = await getProfile(uid);
  const metal = one(form.get("metal"), ["gold", "silver", "mixed"] as const, "gold");
  const budgetRaw = String(form.get("budget") || "");
  const likes: string[] = [], dislikes: string[] = [];
  PAIRS.forEach(([a, b], i) => {
    const pick = String(form.get(`pair${i}`) || "");
    if (pick === a || pick === b) { likes.push(pick); dislikes.push(pick === a ? b : a); }
  });
  const p: UserProfile = {
    ...prev,
    onboarded: true,
    skinTone: one(form.get("tone"), ["light", "medium", "deep"] as const, "medium"),
    jewelryMetal: metal,
    undertone: metal === "gold" ? "warm" : metal === "silver" ? "cool" : "neutral",
    length: form.get("length") ? one(form.get("length"), ["short", "medium", "long"] as const, "short") : null,
    shape: form.get("shape") ? one(form.get("shape"), ["Almond", "Oval", "Square", "Squoval", "Coffin", "Round"] as const, "Almond") : null,
    budget: budgetRaw && budgetRaw !== "any" ? Number(budgetRaw) : null,
    vibe: one(form.get("vibe"), ["subtle", "balanced", "bold"] as const, "balanced"),
    likes: likes.length ? likes : prev.likes,
    dislikes: likes.length ? dislikes : prev.dislikes,
  };
  await saveProfile(uid, p);
  await recordEvent({ userId: uid, type: prev.onboarded ? "profile_edit" : "onboarding_done" });
  redirect("/?welcome=1");
}

export async function saveSalon(form: FormData) {
  const uid = uidOf();
  const p = await getProfile(uid);
  const clean = (k: string, max = 200) => String(form.get(k) || "").trim().slice(0, max) || undefined;
  const name = clean("name", 80);
  let bookingUrl = clean("bookingUrl");
  if (bookingUrl && !/^https?:\/\//i.test(bookingUrl)) bookingUrl = `https://${bookingUrl}`;
  const instagram = clean("instagram", 60)?.replace(/^@/, "");
  await saveProfile(uid, { ...p, salon: name ? { name, bookingUrl, instagram, phone: clean("phone", 30) } : null });
  await recordEvent({ userId: uid, type: name ? "salon_saved" : "salon_removed" });
  redirect("/salons?saved=1");
}

export async function resetProfile() {
  const uid = uidOf();
  const p = await getProfile(uid);
  await saveProfile(uid, { ...DEFAULT_PROFILE, salon: p.salon });
  redirect("/start");
}

const WINDOWS = TIME_WINDOWS.map((w) => w.value);

/** "Book this look": a booking request tied to one look (and optionally one tech). No payment, no calendar yet. */
export async function submitBookingRequest(form: FormData) {
  const uid = uidOf();
  const { getLook, getTech } = await import("./engine");
  const lookId = String(form.get("lookId") || "");
  const look = getLook(lookId);
  if (!look) redirect("/");
  const techRaw = String(form.get("tech") || "");
  const techSlug = techRaw && getTech(techRaw) ? techRaw : null;
  const name = String(form.get("name") || "").trim().slice(0, 80);
  const contact = String(form.get("contact") || "").trim().slice(0, 80);
  const back = `/looks/${lookId}/book${techSlug ? `?tech=${techSlug}&` : "?"}`;
  if (!name || !contact) redirect(`${back}error=missing`);
  const date = String(form.get("date") || "");
  const preferredDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const timeWindow = one(form.get("window"), WINDOWS, "any");
  const note = String(form.get("note") || "").trim().slice(0, 500) || null;
  await createBookingRequest({ uid, lookId, techSlug, name, contact, preferredDate, timeWindow, note });
  await recordEvent({ userId: uid, type: "booking_request", lookId, techSlug, timeWindow });
  redirect(`${back}sent=1`);
}
