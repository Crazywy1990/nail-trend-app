"use server";

import { redirect } from "next/navigation";
import { endSession, sessionUid } from "./auth";
import { checkText, cleanNickname } from "./moderation";
import { recordEvent } from "./store";
import { getPost } from "./store/community";
import { addReview, deleteAccount, deleteReview, getUser, updateUser } from "./store/social";
import { MAX_STYLES, PROFILE_STYLES } from "./profileStyles";

const safeNext = (v: FormDataEntryValue | null) => {
  const s = String(v || "");
  return s.startsWith("/") && !s.startsWith("//") ? s : null;
};
const back = (path: string, error: string) => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}`);

async function me(): Promise<string> {
  const uid = await sessionUid();
  if (!uid) redirect("/login");
  return uid;
}

function cleanBio(raw: FormDataEntryValue | null): string | null | false {
  // Keep up to 3 line breaks; collapse other whitespace.
  const s = String(raw || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4).join("\n").slice(0, 160);
  if (/(https?:\/\/|www\.)/i.test(s)) return false;
  return s || null;
}

/** First sign-in: pick @handle and display name. */
export async function chooseHandle(form: FormData) {
  const uid = await me();
  const next = safeNext(form.get("next")) ?? "/community";
  const here = `/welcome?next=${encodeURIComponent(next)}`;
  const handle = String(form.get("handle") || "").trim().toLowerCase().replace(/^@/, "");
  const nickname = cleanNickname(String(form.get("nickname") || "")) ?? undefined;
  if (form.get("nickname") && !nickname) back(here, "Display name: 2–20 letters or numbers, no links or phone numbers.");
  if ((await checkText([handle, nickname].filter(Boolean).join(" "))) === "flagged") back(here, "Please choose a different name.");
  const err = await updateUser(uid, { handle, nickname: nickname ?? handle });
  if (err) back(here, err);
  await recordEvent({ userId: uid, type: "handle_set" });
  redirect(next);
}

/** Edit profile: display name, bio, whether her liked sets are public. */
export async function saveAccount(form: FormData) {
  const uid = await me();
  const nickname = cleanNickname(String(form.get("nickname") || ""));
  if (!nickname) back("/settings", "Display name: 2–20 letters or numbers, no links or phone numbers.");
  const bio = cleanBio(form.get("bio"));
  if (bio === false) back("/settings", "Bios can't include links.");
  const location = String(form.get("location") || "").replace(/\s+/g, " ").trim().slice(0, 40) || null;
  if (location && /(https?:\/\/|www\.|\d{5,})/i.test(location)) back("/settings", "Location: just a city or area, like \"Bellevue, WA\".");
  const styles = form.getAll("styles").map(String).filter((x) => (PROFILE_STYLES as readonly string[]).includes(x)).slice(0, MAX_STYLES);
  if ((await checkText(`${nickname} ${bio ?? ""} ${location ?? ""}`)) === "flagged") back("/settings", "Please keep your name, bio and location kind.");
  await updateUser(uid, { nickname: nickname!, bio: bio as string | null, showLikes: form.get("showLikes") === "on", location, styles });
  const u = await getUser(uid);
  redirect(u?.handle ? `/u/${u.handle}?saved=1` : "/profile");
}

export async function logOut() {
  endSession();
  redirect("/profile?signedout=1");
}

/** Salon review: 1–5 stars and a few words. AI moderation; clean reviews go live at once. */
export async function submitReview(form: FormData) {
  const uid = await me();
  const user = await getUser(uid);
  if (!user?.handle) redirect("/welcome?next=/reviews/new");
  const postId = String(form.get("postId") || "") || null;
  const here = `/reviews/new${postId ? `?post=${postId}` : ""}`;
  const salonName = String(form.get("name") || "").trim().slice(0, 120);
  const rating = Number(form.get("rating"));
  const body = String(form.get("body") || "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!salonName) back(here, "Which salon was it?");
  if (!(rating >= 1 && rating <= 5)) back(here, "Pick a star rating.");
  if (body.length < 10) back(here, "Tell people a little more (at least 10 characters).");
  if (/(https?:\/\/|www\.)/i.test(body)) back(here, "Reviews can't include links.");
  if ((await checkText(body)) === "flagged") back(here, "This review doesn't meet our community guidelines. Please describe your experience without insults.");
  const post = postId ? await getPost(postId) : null;
  await addReview({
    uid, salonName, rating: Math.round(rating), body,
    salonAddress: String(form.get("address") || "") || null, placeId: String(form.get("placeId") || "") || null,
    mapsUrl: String(form.get("mapsUrl") || "") || null, postId: post && post.uid === uid ? post.id : null,
  });
  await recordEvent({ userId: uid, type: "review", rating });
  redirect(`/u/${user!.handle}?tab=reviews&reviewed=1`);
}

export async function removeReview(form: FormData) {
  const uid = await me();
  await deleteReview(String(form.get("id") || ""), uid);
  const u = await getUser(uid);
  redirect(`/u/${u?.handle}?tab=reviews`);
}

/** Settings → Delete account. She must type DELETE to confirm. */
export async function deleteMyAccount(form: FormData) {
  const uid = await me();
  if (String(form.get("confirm") || "").trim().toUpperCase() !== "DELETE") back("/settings/delete", "Type DELETE to confirm.");
  await deleteAccount(uid);
  endSession();
  console.log(JSON.stringify({ tag: "allten-event", type: "account_deleted", at: new Date().toISOString() }));
  redirect("/profile?accountdeleted=1");
}
