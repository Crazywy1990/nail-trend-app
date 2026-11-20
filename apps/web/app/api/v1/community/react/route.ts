import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/store";
import { setReact, type ReactKind } from "@/lib/store/community";

const KINDS: ReactKind[] = ["like", "save", "report"];

/** Like, save or report a community post. Body: { postId, kind, on } */
export async function POST(req: Request) {
  const uid = cookies().get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "No user" }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { postId?: string; kind?: ReactKind; on?: boolean };
  if (!b.postId || !b.kind || !KINDS.includes(b.kind)) return NextResponse.json({ error: "postId and kind required" }, { status: 400 });
  const counts = await setReact(uid, b.postId, b.kind, !!b.on);
  if (!counts) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await recordEvent({ userId: uid, type: `post_${b.kind}${b.on ? "" : "_undo"}`, postId: b.postId });
  return NextResponse.json(counts);
}
