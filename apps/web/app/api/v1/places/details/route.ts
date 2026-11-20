import { NextResponse } from "next/server";
import { details, placesConfigured } from "@/lib/places";

export const dynamic = "force-dynamic";

/** The picked salon's name, address, phone, website and Maps link: GET ?id=<placeId>&session=<uuid> */
export async function GET(req: Request) {
  if (!placesConfigured()) return NextResponse.json({ configured: false }, { status: 501 });
  const u = new URL(req.url);
  const id = (u.searchParams.get("id") || "").slice(0, 300);
  const session = (u.searchParams.get("session") || "").slice(0, 64);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    return NextResponse.json(await details(id, session));
  } catch (e) {
    console.error("[allten] places details failed", e);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
