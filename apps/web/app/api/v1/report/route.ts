import { NextResponse } from "next/server";
import { actorUid } from "@/lib/auth";
import { report } from "@/lib/store/social";

/** Report a comment or review. Body: { kind: "comment" | "review", id } */
export async function POST(req: Request) {
  const me = await actorUid();
  const b = (await req.json().catch(() => ({}))) as { kind?: string; id?: string };
  if (!me || !b.id || (b.kind !== "comment" && b.kind !== "review")) return NextResponse.json({ error: "kind and id required" }, { status: 400 });
  await report(me, b.kind, b.id);
  return NextResponse.json({ ok: true });
}
