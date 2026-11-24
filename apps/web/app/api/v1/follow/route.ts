import { NextResponse } from "next/server";
import { sessionUid } from "@/lib/auth";
import { recordEvent } from "@/lib/store";
import { profileStats, setFollow, userByHandle } from "@/lib/store/social";

/** Follow or unfollow. Signed-in only. Body: { handle, on } */
export async function POST(req: Request) {
  const me = await sessionUid();
  if (!me) return NextResponse.json({ error: "Sign in to follow people.", signIn: true }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { handle?: string; on?: boolean };
  const them = b.handle ? await userByHandle(b.handle) : null;
  if (!them || them.uid === me) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await setFollow(me, them.uid, !!b.on);
  await recordEvent({ userId: me, type: b.on ? "follow" : "unfollow", target: them.uid });
  const s = await profileStats(them.uid, me);
  return NextResponse.json({ following: s.iFollow, followers: s.followers });
}
