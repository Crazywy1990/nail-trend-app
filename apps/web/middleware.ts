import { NextResponse, type NextRequest } from "next/server";
import { isSeason, seasonFor } from "./lib/season";
import { SESSION_COOKIE, verifySession } from "./lib/session";

/**
 * - Gives every visitor an anonymous id (cookie "uid") so events and profiles join up.
 *   A valid signed session (cookie "sess") wins: then the id is her account's.
 * - Resolves the theme: ?theme= override (remembered in a cookie), else the date.
 */
export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const themeParam = url.searchParams.get("theme");
  const themeCookie = req.cookies.get("theme")?.value;
  const season = isSeason(themeParam) ? themeParam : isSeason(themeCookie) ? themeCookie : seasonFor(new Date());

  const account = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  let uid = account ?? req.cookies.get("uid")?.value;
  const newUid = !uid || (!!account && req.cookies.get("uid")?.value !== account);
  if (!uid) uid = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

  const headers = new Headers(req.headers);
  headers.set("x-season", season);
  headers.set("x-uid", uid);
  const res = NextResponse.next({ request: { headers } });

  const year = 60 * 60 * 24 * 365;
  if (newUid) res.cookies.set("uid", uid, { maxAge: year, sameSite: "lax", path: "/" });
  if (isSeason(themeParam)) res.cookies.set("theme", themeParam, { maxAge: year, sameSite: "lax", path: "/" });
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|looks/.*\\.jpg|favicon|icon).*)"],
};
