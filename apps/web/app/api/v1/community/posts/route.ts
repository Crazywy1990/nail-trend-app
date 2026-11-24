import { NextResponse } from "next/server";
import sharp from "sharp";
import { sessionUid } from "@/lib/auth";
import { checkUpload } from "@/lib/moderation";
import { getUser } from "@/lib/store/social";
import { recordEvent } from "@/lib/store";
import { DAILY_UPLOADS, createPost, deletePost, newPostId, storeImage, uploadsToday } from "@/lib/store/community";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Upload a photo of her own set (signed in, with a handle). multipart/form-data: photo, caption?, consent=yes.
 * The photo is re-encoded (which drops EXIF, including GPS), checked by AI, and queued for the owner's review.
 */
export async function POST(req: Request) {
  const uid = await sessionUid();
  if (!uid) return bad("Sign in to share your nails.", 401);
  const user = await getUser(uid);
  if (!user?.handle) return bad("Pick your @handle first.", 403);
  const nickname = user.nickname || user.handle;
  let form: FormData;
  try { form = await req.formData(); } catch { return bad("That upload didn't come through. Try a smaller photo."); }

  if (form.get("consent") !== "yes") return bad("Please confirm the photo is yours and agree to the guidelines.");
  const caption = String(form.get("caption") || "").replace(/\s+/g, " ").trim().slice(0, 200) || null;
  if (caption && /(https?:\/\/|www\.)/i.test(caption)) return bad("Captions can't include links.");

  const file = form.get("photo");
  if (!(file instanceof Blob) || !file.size) return bad("Choose a photo of your nails.");
  if (file.size > MAX_BYTES) return bad("That photo is too large. Try one under 8 MB.");
  if ((await uploadsToday(uid)) >= DAILY_UPLOADS) return bad(`You can share up to ${DAILY_UPLOADS} sets a day. Come back tomorrow!`, 429);

  let full: { data: Buffer; info: sharp.OutputInfo };
  let small: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const base = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
    full = await base.clone().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    small = await base.clone().resize(512, 512, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    return bad("We couldn't read that file. Use a JPG, PNG, WebP or HEIC photo.");
  }

  const { ai, tags } = await checkUpload(small, [nickname, caption].filter(Boolean).join("\n"));
  const id = newPostId();
  const imageUrl = await storeImage(id, full.data, "image/webp");
  const status = ai.verdict === "reject" ? "rejected" : "pending";
  await createPost({ id, uid, nickname, imageUrl, width: full.info.width, height: full.info.height, caption, tags, ai, status });

  await recordEvent({ userId: uid, type: "post_upload", postId: id, verdict: ai.verdict });
  return NextResponse.json({ id, status, reason: ai.reason }, { status: 201 });
}

/** Delete her own post. Body: { id } */
export async function DELETE(req: Request) {
  const uid = await sessionUid();
  const b = (await req.json().catch(() => ({}))) as { id?: string };
  if (!uid || !b.id) return bad("id required");
  const ok = await deletePost(b.id, uid);
  if (ok) await recordEvent({ userId: uid, type: "post_delete", postId: b.id });
  return ok ? NextResponse.json({ ok: true }) : bad("Not found", 404);
}
