import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordEvent, setSaved } from "@/lib/store";

/** Save or unsave a look for this browser's user. Body: { lookId, on, setId?, slot?, position? } */
export async function POST(req: Request) {
  const uid = cookies().get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "No user" }, { status: 400 });
  let b: { lookId?: string; on?: boolean; [k: string]: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!b.lookId || typeof b.lookId !== "string") return NextResponse.json({ error: "lookId required" }, { status: 400 });
  const saved = await setSaved(uid, b.lookId, !!b.on);
  const { lookId, on, ...rest } = b;
  await recordEvent({ userId: uid, type: on ? "save" : "unsave", lookId, ...rest });
  return NextResponse.json({ saved });
}
