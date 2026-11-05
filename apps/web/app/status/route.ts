import { NextResponse } from "next/server";
import { API_URL, USE_REMOTE_API } from "@/lib/api";
import { LOOKS, RANKING_VERSION, TRENDS_UPDATED, discover } from "@/lib/engine";

export const dynamic = "force-dynamic";

/** Deployment check: which data source the web app uses, and whether it works. */
export async function GET() {
  const started = Date.now();
  if (!USE_REMOTE_API) {
    try {
      const d = discover("status-check", "", { occasion: [], finish: [], length: [] });
      return NextResponse.json({
        ok: true,
        dataSource: "built-in engine",
        rankingVersion: RANKING_VERSION,
        looks: LOOKS.length,
        trendsUpdated: TRENDS_UPDATED,
        looksWithRealTrendData: LOOKS.filter((l) => !l.trendProof.isPlaceholder).length,
        sampleSet: d.summary,
        ms: Date.now() - started,
      });
    } catch (err) {
      return NextResponse.json({ ok: false, dataSource: "built-in engine", error: String(err) }, { status: 500 });
    }
  }
  try {
    const res = await fetch(`${API_URL}/healthz`, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
    const body = await res.json().catch(() => null);
    return NextResponse.json({ ok: res.ok, dataSource: "remote API", apiUrl: API_URL, apiStatus: res.status, apiBody: body, ms: Date.now() - started });
  } catch (err) {
    return NextResponse.json(
      { ok: false, dataSource: "remote API", apiUrl: API_URL, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err), ms: Date.now() - started },
      { status: 503 },
    );
  }
}
