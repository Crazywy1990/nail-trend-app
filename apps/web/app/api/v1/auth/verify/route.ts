import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { startSession } from "@/lib/auth";
import { recordEvent } from "@/lib/store";
import { checkCode, getUser, signIn } from "@/lib/store/social";

/** Step 2: check the code, sign in (merging this browser's anonymous activity), set the session. Body: { email, code } */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
  const email = String(b.email || "").trim().toLowerCase();
  const code = String(b.code || "").replace(/\D/g, "");
  if (!email || code.length !== 6) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  const r = await checkCode(email, code);
  if (r === "wrong") return NextResponse.json({ error: "That code isn't right. Check the email and try again." }, { status: 400 });
  if (r === "expired") return NextResponse.json({ error: "That code expired. Send a new one." }, { status: 400 });
  const deviceUid = cookies().get("uid")?.value || crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const { uid, isNew } = await signIn(email, deviceUid);
  await startSession(uid);
  await recordEvent({ userId: uid, type: isNew ? "signup" : "login" });
  const user = await getUser(uid);
  return NextResponse.json({ ok: true, needsHandle: !user?.handle });
}
