import { NextResponse } from "next/server";
import sharp from "sharp";
import { sessionUid } from "@/lib/auth";
import { checkImage } from "@/lib/moderation";
import { newPostId, storeImage } from "@/lib/store/community";
import { updateUser } from "@/lib/store/social";

export const runtime = "nodejs";
export const maxDuration = 30;

const SIZES = { avatar: { w: 400, h: 400 }, cover: { w: 1500, h: 600 } } as const;
type Kind = keyof typeof SIZES;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Set her profile photo or cover. multipart: kind=avatar|cover, photo. Cropped to fit, EXIF dropped, AI-moderated. */
export async function POST(req: Request) {
  const uid = await sessionUid();
  if (!uid) return bad("Sign in first.", 401);
  const form = await req.formData().catch(() => null);
  const kind = form?.get("kind") as Kind;
  const file = form?.get("photo");
  if (!form || !(kind in SIZES)) return bad("kind must be avatar or cover");
  if (!(file instanceof Blob) || !file.size) return bad("Choose a photo.");
  if (file.size > 8 * 1024 * 1024) return bad("That photo is too large. Try one under 8 MB.");
  let out: Buffer, small: Buffer;
  try {
    const base = sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
    const { w, h } = SIZES[kind];
    out = await base.clone().resize(w, h, { fit: "cover", position: "attention" }).webp({ quality: 82 }).toBuffer();
    small = await base.clone().resize(512, 512, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    return bad("We couldn't read that file. Use a JPG, PNG, WebP or HEIC photo.");
  }
  if ((await checkImage(small)) === "flagged") return bad("This photo doesn't meet our community guidelines.");
  const url = await storeImage(`${kind === "avatar" ? "av" : "cv"}${newPostId()}`, out, "image/webp");
  await updateUser(uid, kind === "avatar" ? { avatarUrl: url } : { coverUrl: url });
  return NextResponse.json({ url });
}

/** Remove the profile photo or cover. Body: { kind } */
export async function DELETE(req: Request) {
  const uid = await sessionUid();
  if (!uid) return bad("Sign in first.", 401);
  const b = (await req.json().catch(() => ({}))) as { kind?: Kind };
  if (b.kind !== "avatar" && b.kind !== "cover") return bad("kind must be avatar or cover");
  await updateUser(uid, b.kind === "avatar" ? { avatarUrl: null } : { coverUrl: null });
  return NextResponse.json({ ok: true });
}
