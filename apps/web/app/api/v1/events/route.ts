import { NextResponse } from "next/server";
import { API_URL, USE_REMOTE_API } from "@/lib/api";
import { recordEvent } from "@/lib/store";

/**
 * Event intake (impressions, rejects, "Too bold", book/share clicks, landings).
 * Built-in mode: stored in Postgres when DATABASE_URL is set, and always logged
 * (Vercel → Logs, filter "allten-event"). Remote mode: forwarded to the Python service.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (USE_REMOTE_API) {
    try {
      const res = await fetch(`${API_URL}/v1/events`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    } catch (err) {
      console.error("[allten] event forward failed:", err);
    }
  }
  if (typeof body.type !== "string") return NextResponse.json({ error: "type required" }, { status: 400 });
  await recordEvent(body as { type: string });
  return NextResponse.json({ ok: true }, { status: 201 });
}
