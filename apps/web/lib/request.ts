import { headers } from "next/headers";
import { isSeason, type Season } from "./season";

export function requestSeason(): Season {
  const s = headers().get("x-season");
  return isSeason(s) ? s : "base";
}

export function requestUid(): string {
  return headers().get("x-uid") || "anon";
}

export function siteUrl(): string {
  return process.env.SITE_URL || "http://localhost:3000";
}
