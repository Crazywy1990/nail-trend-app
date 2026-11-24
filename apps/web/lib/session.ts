/**
 * Signed session cookie "sess" = "<uid>.<hmac>". Web Crypto only, so it works in middleware (edge) and on the server.
 * Secret: AUTH_SECRET, else derived from DATABASE_URL (server-only) so it works without extra setup.
 */
export const SESSION_COOKIE = "sess";
export const SESSION_DAYS = 180;

const enc = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;
function key() {
  keyPromise ??= (async () => {
    const raw = process.env.AUTH_SECRET || `allten-session:${process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.ADMIN_KEY || "dev"}`;
    const material = await crypto.subtle.digest("SHA-256", enc.encode(raw));
    return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  })();
  return keyPromise;
}
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function mac(uid: string) {
  return b64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(`v1:${uid}`)));
}

export async function signSession(uid: string): Promise<string> {
  return `${uid}.${await mac(uid)}`;
}

/** The signed-in uid, or null if the cookie is missing or forged. */
export async function verifySession(value: string | undefined | null): Promise<string | null> {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i < 1) return null;
  const uid = value.slice(0, i);
  if (!/^[a-z0-9]{8,40}$/.test(uid)) return null;
  const expected = await mac(uid);
  const given = value.slice(i + 1);
  if (expected.length !== given.length) return null;
  let diff = 0;
  for (let k = 0; k < expected.length; k++) diff |= expected.charCodeAt(k) ^ given.charCodeAt(k);
  return diff === 0 ? uid : null;
}
