import { NextResponse } from "next/server";
import { emailConfigured, sendCode } from "@/lib/email";
import { hasSocial, issueCode } from "@/lib/store/social";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

/** Step 1 of sign-in: email a 6-digit code. Body: { email } */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { email?: string };
  const email = String(b.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!hasSocial() || !emailConfigured()) return NextResponse.json({ error: "Sign-in isn't set up yet. Try again soon." }, { status: 503 });
  const code = await issueCode(email);
  if (!code) return NextResponse.json({ error: "Too many codes requested. Try again in an hour." }, { status: 429 });
  if (!(await sendCode(email, code))) return NextResponse.json({ error: "We couldn't send the email. Try again in a minute." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
