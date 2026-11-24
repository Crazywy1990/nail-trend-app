import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "./session";
import { getUser, type User } from "./store/social";

/** Signed-in account uid (verified), or null. */
export async function sessionUid(): Promise<string | null> {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  const uid = await sessionUid();
  return uid ? getUser(uid) : null;
}

/** Who is acting: the signed-in account, else the anonymous browser id. */
export async function actorUid(): Promise<string | null> {
  return (await sessionUid()) ?? headers().get("x-uid") ?? cookies().get("uid")?.value ?? null;
}

const year = 60 * 60 * 24 * 365;
/** Call from a route handler or server action. */
export async function startSession(uid: string) {
  const secure = process.env.NODE_ENV === "production";
  cookies().set(SESSION_COOKIE, await signSession(uid), { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
  cookies().set("uid", uid, { sameSite: "lax", path: "/", maxAge: year });
}

/** Log out: drop the session and give the browser a fresh anonymous id, so nothing more is tied to the account. */
export function endSession() {
  cookies().delete(SESSION_COOKIE);
  cookies().set("uid", crypto.randomUUID().replace(/-/g, "").slice(0, 24), { sameSite: "lax", path: "/", maxAge: year });
}
