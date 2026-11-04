import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Deployment check: which API the web app is pointed at, and whether it answers. */
export async function GET() {
  const started = Date.now();
  try {
    const res = await fetch(`${API_URL}/healthz`, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
    const body = await res.json().catch(() => null);
    return NextResponse.json({
      apiUrl: API_URL,
      apiConfigured: Boolean(process.env.API_URL),
      apiReachable: res.ok,
      apiStatus: res.status,
      apiBody: body,
      ms: Date.now() - started,
    });
  } catch (err) {
    return NextResponse.json(
      {
        apiUrl: API_URL,
        apiConfigured: Boolean(process.env.API_URL),
        apiReachable: false,
        error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        ms: Date.now() - started,
      },
      { status: 503 },
    );
  }
}
