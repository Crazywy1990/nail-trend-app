import { NextResponse } from "next/server";
import { API_URL, USE_REMOTE_API } from "@/lib/api";

/**
 * Event intake (impressions, saves, rejects, "Too bold", book/share clicks, landings).
 * Built-in mode: each event is written as one JSON line to the server log
 * (Vercel → Logs, filter "allten-event"), so nothing is lost before a database exists.
 * Remote mode: forwarded to the Python service, which updates the profile.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (USE_REMOTE_API) {
    try {
      const res = await fetch(`${API_URL}/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    } catch (err) {
      console.error("[allten] event forward failed:", err);
    }
  }
  console.log(JSON.stringify({ tag: "allten-event", at: new Date().toISOString(), ...(body as object) }));
  return NextResponse.json({ ok: true }, { status: 201 });
}
