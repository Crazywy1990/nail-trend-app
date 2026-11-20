import { NextResponse } from "next/server";
import { autocomplete, centerFrom, placesConfigured } from "@/lib/places";

export const dynamic = "force-dynamic";

/** Salon suggestions near her: GET ?q=lux&session=<uuid>[&lat=&lng=] */
export async function GET(req: Request) {
  if (!placesConfigured()) return NextResponse.json({ configured: false, suggestions: [] });
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const session = (u.searchParams.get("session") || "").slice(0, 64);
  if (q.length < 2 || !session) return NextResponse.json({ configured: true, suggestions: [] });
  try {
    const suggestions = await autocomplete(q, session, centerFrom(req, u.searchParams.get("lat"), u.searchParams.get("lng")));
    return NextResponse.json({ configured: true, suggestions });
  } catch (e) {
    console.error("[allten] places autocomplete failed", e);
    return NextResponse.json({ configured: true, suggestions: [], error: "unavailable" }, { status: 502 });
  }
}
