/**
 * Per-user storage: profile, saved looks, events.
 * With DATABASE_URL (Neon via the Vercel integration) everything lives in Postgres.
 * Without it, profile and saved looks live in a cookie on her browser, so onboarding
 * and saving work today and move to the database as soon as one is connected.
 */
import { cookies } from "next/headers";
import { neon } from "@neondatabase/serverless";

export type SkinTone = "light" | "medium" | "deep";
export type Salon = { name: string; bookingUrl?: string; instagram?: string; phone?: string };
export type UserProfile = {
  onboarded: boolean;
  skinTone: SkinTone;
  undertone: "warm" | "cool" | "neutral";
  jewelryMetal: "gold" | "silver" | "mixed";
  length: "short" | "medium" | "long" | null;
  shape: string | null;
  budget: number | null;           // max she usually spends, USD
  vibe: "subtle" | "balanced" | "bold";
  likes: string[];                 // look ids picked in this-or-that
  dislikes: string[];              // look ids she passed on
  salon: Salon | null;
};

export const DEFAULT_PROFILE: UserProfile = {
  onboarded: false, skinTone: "medium", undertone: "warm", jewelryMetal: "gold",
  length: null, shape: null, budget: null, vibe: "balanced", likes: [], dislikes: [], salon: null,
};

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
export const hasDatabase = () => !!DB_URL;
const sql = DB_URL ? neon(DB_URL) : null;

let schemaReady: Promise<unknown> | null = null;
function ensureSchema() {
  if (!sql) return Promise.resolve();
  schemaReady ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS profiles (uid text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS saved (uid text NOT NULL, look_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (uid, look_id))`;
    await sql`CREATE TABLE IF NOT EXISTS events (id bigserial PRIMARY KEY, uid text, type text NOT NULL, look_id text, data jsonb, at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS events_type_at ON events (type, at)`;
  })().catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

const YEAR = 60 * 60 * 24 * 365;
const COOKIE_OPTS = { maxAge: YEAR, sameSite: "lax" as const, path: "/", httpOnly: true };

function readCookieJson<T>(name: string, fallback: T): T {
  try {
    const v = cookies().get(name)?.value;
    return v ? (JSON.parse(Buffer.from(v, "base64url").toString("utf8")) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeCookieJson(name: string, value: unknown) {
  cookies().set(name, Buffer.from(JSON.stringify(value)).toString("base64url"), COOKIE_OPTS);
}

// ---------------------------------------------------------------- profile
export async function getProfile(uid: string): Promise<UserProfile> {
  if (sql) {
    try {
      await ensureSchema();
      const rows = await sql`SELECT data FROM profiles WHERE uid = ${uid}`;
      if (rows[0]) return { ...DEFAULT_PROFILE, ...(rows[0].data as Partial<UserProfile>) };
    } catch (e) {
      console.error("[allten] profile read failed", e);
    }
  }
  return { ...DEFAULT_PROFILE, ...readCookieJson<Partial<UserProfile>>("profile", {}) };
}

/** Call from a server action or route handler (cookie fallback needs a writable response). */
export async function saveProfile(uid: string, p: UserProfile): Promise<void> {
  if (sql) {
    try {
      await ensureSchema();
      await sql`INSERT INTO profiles (uid, data) VALUES (${uid}, ${JSON.stringify(p)}::jsonb)
                ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
      return;
    } catch (e) {
      console.error("[allten] profile write failed; keeping it in the cookie", e);
    }
  }
  writeCookieJson("profile", p);
}

// ---------------------------------------------------------------- saved
export async function listSaved(uid: string): Promise<string[]> {
  if (sql) {
    try {
      await ensureSchema();
      const rows = await sql`SELECT look_id FROM saved WHERE uid = ${uid} ORDER BY created_at DESC`;
      return rows.map((r) => r.look_id as string);
    } catch (e) {
      console.error("[allten] saved read failed", e);
    }
  }
  return readCookieJson<string[]>("saved", []);
}

export async function setSaved(uid: string, lookId: string, on: boolean): Promise<string[]> {
  if (sql) {
    try {
      await ensureSchema();
      if (on) await sql`INSERT INTO saved (uid, look_id) VALUES (${uid}, ${lookId}) ON CONFLICT DO NOTHING`;
      else await sql`DELETE FROM saved WHERE uid = ${uid} AND look_id = ${lookId}`;
      return listSaved(uid);
    } catch (e) {
      console.error("[allten] saved write failed; keeping it in the cookie", e);
    }
  }
  const cur = readCookieJson<string[]>("saved", []).filter((x) => x !== lookId);
  const next = on ? [lookId, ...cur].slice(0, 100) : cur;
  writeCookieJson("saved", next);
  return next;
}

// ---------------------------------------------------------------- events
export async function recordEvent(e: { userId?: string; type: string; lookId?: string } & Record<string, unknown>): Promise<void> {
  console.log(JSON.stringify({ tag: "allten-event", at: new Date().toISOString(), ...e }));
  if (!sql) return;
  try {
    await ensureSchema();
    const { userId, type, lookId, ...rest } = e;
    await sql`INSERT INTO events (uid, type, look_id, data) VALUES (${userId ?? null}, ${type}, ${lookId ?? null}, ${JSON.stringify(rest)}::jsonb)`;
  } catch (err) {
    console.error("[allten] event write failed", err);
  }
}
