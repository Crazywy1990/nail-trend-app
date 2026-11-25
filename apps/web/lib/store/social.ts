/**
 * Accounts and the social layer (and the community tables: posts, post_reacts, post_images): email-code sign-in, @handles, follows, comments, salon reviews, reports.
 * An account's id IS a uid: signing up keeps the browser's existing uid (so her saves, likes and posts carry over);
 * signing in on another device moves that device's anonymous activity into the account.
 * Needs Postgres; without a database these return empty results and writes fail.
 */
import { createHash, randomInt } from "crypto";
import { db as sql, ensureSchema } from "./index";

export type User = {
  uid: string; email: string; handle: string | null; nickname: string | null; bio: string | null;
  showLikes: boolean; createdAt: string;
  avatarUrl: string | null; coverUrl: string | null; location: string | null; styles: string[];
};
export type PublicUser = { uid: string; handle: string; nickname: string; bio: string | null; showLikes: boolean; avatarUrl: string | null };
export type Comment = {
  id: string; postId: string; uid: string; handle: string | null; nickname: string; body: string;
  parentId: string | null; createdAt: string; mine: boolean; avatarUrl: string | null;
};
export type Review = {
  id: string; uid: string; handle: string | null; salonName: string; salonAddress: string | null; placeId: string | null;
  mapsUrl: string | null; rating: number; body: string; postId: string | null; createdAt: string;
};

const need = () => { if (!sql) throw new Error("Accounts need a database"); return sql; };
export const hasSocial = () => !!sql;

let ready: Promise<unknown> | null = null;
export function ensureSocial() {
  if (!sql) return Promise.resolve();
  ready ??= (async () => {
    await ensureSchema();
    await sql`CREATE TABLE IF NOT EXISTS posts (
      id text PRIMARY KEY, uid text NOT NULL, nickname text NOT NULL, image_url text NOT NULL,
      width int NOT NULL DEFAULT 0, height int NOT NULL DEFAULT 0, caption text, tags jsonb NOT NULL DEFAULT '{}'::jsonb,
      ai jsonb, status text NOT NULL DEFAULT 'pending', consent_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz)`;
    await sql`CREATE INDEX IF NOT EXISTS posts_status_created ON posts (status, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS posts_uid ON posts (uid, created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS post_reacts (uid text NOT NULL, post_id text NOT NULL, kind text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (uid, post_id, kind))`;
    await sql`CREATE INDEX IF NOT EXISTS post_reacts_post ON post_reacts (post_id, kind)`;
    await sql`CREATE TABLE IF NOT EXISTS post_images (id text PRIMARY KEY, type text NOT NULL, data text NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS users (
      uid text PRIMARY KEY, email text NOT NULL UNIQUE, handle text UNIQUE, nickname text, bio text,
      show_likes boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())`;
    // Profile page extras (RedNote-style): photo, cover, location, favorite styles.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS styles text[] NOT NULL DEFAULT '{}'`;
    await sql`CREATE TABLE IF NOT EXISTS login_codes (
      email text PRIMARY KEY, code_hash text NOT NULL, expires_at timestamptz NOT NULL, attempts int NOT NULL DEFAULT 0,
      sends int NOT NULL DEFAULT 1, window_start timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS follows (follower text NOT NULL, followee text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (follower, followee))`;
    await sql`CREATE INDEX IF NOT EXISTS follows_followee ON follows (followee)`;
    await sql`CREATE TABLE IF NOT EXISTS comments (id text PRIMARY KEY, post_id text NOT NULL, uid text NOT NULL, body text NOT NULL,
      parent_id text, status text NOT NULL DEFAULT 'live', created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS comments_post ON comments (post_id, created_at)`;
    await sql`CREATE TABLE IF NOT EXISTS reviews (id text PRIMARY KEY, uid text NOT NULL, place_id text, salon_name text NOT NULL,
      salon_address text, maps_url text, rating int NOT NULL, body text NOT NULL, post_id text, status text NOT NULL DEFAULT 'live',
      created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS reviews_uid ON reviews (uid, created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS reports (uid text NOT NULL, kind text NOT NULL, target text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (uid, kind, target))`;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
type Row = Record<string, unknown>;
const toUser = (r: Row): User => ({
  uid: r.uid as string, email: r.email as string, handle: (r.handle as string) ?? null, nickname: (r.nickname as string) ?? null,
  bio: (r.bio as string) ?? null, showLikes: !!r.show_likes, createdAt: r.created_at as string,
  avatarUrl: (r.avatar_url as string) ?? null, coverUrl: (r.cover_url as string) ?? null,
  location: (r.location as string) ?? null, styles: (r.styles as string[]) ?? [],
});

// ---------------------------------------------------------------- users
export async function getUser(uid: string): Promise<User | null> {
  if (!sql) return null;
  await ensureSocial();
  const [r] = await sql`SELECT *, created_at::text AS created_at FROM users WHERE uid = ${uid}`;
  return r ? toUser(r) : null;
}

export async function userByHandle(handle: string): Promise<User | null> {
  if (!sql) return null;
  await ensureSocial();
  const [r] = await sql`SELECT *, created_at::text AS created_at FROM users WHERE handle = ${handle.toLowerCase()}`;
  return r ? toUser(r) : null;
}

export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])$/;
const RESERVED = new Set(["admin", "allten", "support", "help", "login", "settings", "community", "official", "staff", "moderator"]);
export function handleProblem(h: string): string | null {
  if (!HANDLE_RE.test(h)) return "3–20 lowercase letters, numbers, dots or underscores; start and end with a letter or number.";
  if (RESERVED.has(h) || h.startsWith("allten")) return "That handle is reserved.";
  return null;
}

export async function updateUser(uid: string, u: {
  handle?: string; nickname?: string; bio?: string | null; showLikes?: boolean; location?: string | null; styles?: string[];
  avatarUrl?: string | null; coverUrl?: string | null;
}): Promise<string | null> {
  const db = need();
  await ensureSocial();
  if (u.handle !== undefined) {
    const p = handleProblem(u.handle);
    if (p) return p;
    const [taken] = await db`SELECT 1 FROM users WHERE handle = ${u.handle} AND uid <> ${uid}`;
    if (taken) return "That handle is taken.";
  }
  await db`UPDATE users SET
      handle = COALESCE(${u.handle ?? null}, handle),
      nickname = COALESCE(${u.nickname ?? null}, nickname),
      bio = CASE WHEN ${u.bio !== undefined} THEN ${u.bio ?? null} ELSE bio END,
      show_likes = COALESCE(${u.showLikes ?? null}, show_likes),
      location = CASE WHEN ${u.location !== undefined} THEN ${u.location ?? null} ELSE location END,
      styles = COALESCE(${u.styles ?? null}::text[], styles),
      avatar_url = CASE WHEN ${u.avatarUrl !== undefined} THEN ${u.avatarUrl ?? null} ELSE avatar_url END,
      cover_url = CASE WHEN ${u.coverUrl !== undefined} THEN ${u.coverUrl ?? null} ELSE cover_url END
    WHERE uid = ${uid}`;
  // Her posts show her current nickname.
  if (u.nickname) await db`UPDATE posts SET nickname = ${u.nickname} WHERE uid = ${uid}`;
  return null;
}

// ---------------------------------------------------------------- email codes
export const CODE_TTL_MIN = 10;
/** Creates a 6-digit code for the email. Returns null when the email asked for too many codes this hour. */
export async function issueCode(email: string): Promise<string | null> {
  const db = need();
  await ensureSocial();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const [row] = await db`SELECT sends, window_start > now() - interval '1 hour' AS recent FROM login_codes WHERE email = ${email}`;
  if (row && row.recent && (row.sends as number) >= 5) return null;
  await db`INSERT INTO login_codes (email, code_hash, expires_at, attempts, sends, window_start)
           VALUES (${email}, ${hash(email + code)}, now() + interval '10 minutes', 0, 1, now())
           ON CONFLICT (email) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0,
             sends = CASE WHEN login_codes.window_start > now() - interval '1 hour' THEN login_codes.sends + 1 ELSE 1 END,
             window_start = CASE WHEN login_codes.window_start > now() - interval '1 hour' THEN login_codes.window_start ELSE now() END`;
  return code;
}

/** Checks a code (5 tries, 10 minutes). On success the code is used up. */
export async function checkCode(email: string, code: string): Promise<"ok" | "wrong" | "expired"> {
  const db = need();
  await ensureSocial();
  const [row] = await db`SELECT code_hash, expires_at > now() AS live, attempts FROM login_codes WHERE email = ${email}`;
  if (!row || !row.live || (row.attempts as number) >= 5) return "expired";
  if (row.code_hash !== hash(email + code)) {
    await db`UPDATE login_codes SET attempts = attempts + 1 WHERE email = ${email}`;
    return "wrong";
  }
  await db`UPDATE login_codes SET expires_at = now() WHERE email = ${email}`;
  return "ok";
}

/**
 * Signs in `email` from a browser whose anonymous id is `deviceUid`. New email: the device's uid becomes the account.
 * Known email: this device's anonymous activity is moved into the account. Returns the account uid.
 */
export async function signIn(email: string, deviceUid: string): Promise<{ uid: string; isNew: boolean }> {
  const db = need();
  await ensureSocial();
  const [existing] = await db`SELECT uid FROM users WHERE email = ${email}`;
  if (!existing) {
    // The device uid may already belong to another account (shared browser after log-out): start fresh then.
    const [clash] = await db`SELECT 1 FROM users WHERE uid = ${deviceUid}`;
    const uid = clash ? crypto.randomUUID().replace(/-/g, "").slice(0, 24) : deviceUid;
    await db`INSERT INTO users (uid, email) VALUES (${uid}, ${email})`;
    return { uid, isNew: true };
  }
  const uid = existing.uid as string;
  const [deviceIsAccount] = await db`SELECT 1 FROM users WHERE uid = ${deviceUid}`;
  if (deviceUid !== uid && !deviceIsAccount) await mergeInto(deviceUid, uid);
  return { uid, isNew: false };
}

async function mergeInto(from: string, to: string) {
  const db = need();
  await db`UPDATE posts SET uid = ${to} WHERE uid = ${from}`;
  await db`INSERT INTO post_reacts (uid, post_id, kind, created_at) SELECT ${to}, post_id, kind, created_at FROM post_reacts WHERE uid = ${from} ON CONFLICT DO NOTHING`;
  await db`DELETE FROM post_reacts WHERE uid = ${from}`;
  await db`INSERT INTO saved (uid, look_id, created_at) SELECT ${to}, look_id, created_at FROM saved WHERE uid = ${from} ON CONFLICT DO NOTHING`;
  await db`DELETE FROM saved WHERE uid = ${from}`;
  await db`UPDATE events SET uid = ${to} WHERE uid = ${from}`;
  await db`UPDATE booking_requests SET uid = ${to} WHERE uid = ${from}`;
  await db`UPDATE profiles SET uid = ${to} WHERE uid = ${from} AND NOT EXISTS (SELECT 1 FROM profiles WHERE uid = ${to})`;
}

// ---------------------------------------------------------------- follows
export async function setFollow(follower: string, followee: string, on: boolean): Promise<void> {
  const db = need();
  await ensureSocial();
  if (follower === followee) return;
  if (on) await db`INSERT INTO follows (follower, followee) VALUES (${follower}, ${followee}) ON CONFLICT DO NOTHING`;
  else await db`DELETE FROM follows WHERE follower = ${follower} AND followee = ${followee}`;
}

export type Stats = { followers: number; following: number; posts: number; likesAndSaves: number; reviews: number; iFollow: boolean };
/** Profile header numbers. likesAndSaves = likes and saves her live posts received (RedNote's 获赞与收藏). */
export async function profileStats(uid: string, viewer: string | null): Promise<Stats> {
  if (!sql) return { followers: 0, following: 0, posts: 0, likesAndSaves: 0, reviews: 0, iFollow: false };
  await ensureSocial();
  const [r] = await sql`SELECT
      (SELECT count(*) FROM follows WHERE followee = ${uid})::int AS followers,
      (SELECT count(*) FROM follows WHERE follower = ${uid})::int AS following,
      (SELECT count(*) FROM posts WHERE uid = ${uid} AND status = 'approved')::int AS posts,
      (SELECT count(*) FROM post_reacts r JOIN posts p ON p.id = r.post_id
         WHERE p.uid = ${uid} AND p.status = 'approved' AND r.kind IN ('like', 'save') AND r.uid <> ${uid})::int AS likes_and_saves,
      (SELECT count(*) FROM reviews WHERE uid = ${uid} AND status = 'live')::int AS reviews,
      EXISTS (SELECT 1 FROM follows WHERE follower = ${viewer ?? ""} AND followee = ${uid}) AS i_follow`;
  return {
    followers: r.followers as number, following: r.following as number, posts: r.posts as number,
    likesAndSaves: r.likes_and_saves as number, reviews: r.reviews as number, iFollow: !!r.i_follow,
  };
}

/** Followers or following of a user, newest first, with whether the viewer follows each. */
export async function followList(uid: string, which: "followers" | "following", viewer: string | null): Promise<(PublicUser & { iFollow: boolean })[]> {
  if (!sql) return [];
  await ensureSocial();
  const rows = which === "followers"
    ? await sql`SELECT u.*, EXISTS (SELECT 1 FROM follows x WHERE x.follower = ${viewer ?? ""} AND x.followee = u.uid) AS i_follow
                FROM follows f JOIN users u ON u.uid = f.follower WHERE f.followee = ${uid} AND u.handle IS NOT NULL ORDER BY f.created_at DESC LIMIT 500`
    : await sql`SELECT u.*, EXISTS (SELECT 1 FROM follows x WHERE x.follower = ${viewer ?? ""} AND x.followee = u.uid) AS i_follow
                FROM follows f JOIN users u ON u.uid = f.followee WHERE f.follower = ${uid} AND u.handle IS NOT NULL ORDER BY f.created_at DESC LIMIT 500`;
  return rows.map((r) => ({ ...publicUser(r), iFollow: !!r.i_follow }));
}

export async function followingUids(uid: string): Promise<string[]> {
  if (!sql) return [];
  await ensureSocial();
  return (await sql`SELECT followee FROM follows WHERE follower = ${uid}`).map((r) => r.followee as string);
}

const publicUser = (r: Row): PublicUser => ({
  uid: r.uid as string, handle: r.handle as string, nickname: (r.nickname as string) || (r.handle as string),
  bio: (r.bio as string) ?? null, showLikes: !!r.show_likes, avatarUrl: (r.avatar_url as string) ?? null,
});

/** Handles for a set of uids (to link post and comment authors). */
export async function handlesFor(uids: string[]): Promise<Map<string, string>> {
  if (!sql || !uids.length) return new Map();
  await ensureSocial();
  const rows = await sql`SELECT uid, handle FROM users WHERE uid = ANY(${[...new Set(uids)]}::text[]) AND handle IS NOT NULL`;
  return new Map(rows.map((r) => [r.uid as string, r.handle as string]));
}

// ---------------------------------------------------------------- comments
export const COMMENT_MAX = 500;
export const REPORTS_TO_REMOVE = 3;

export async function listComments(postId: string, viewer: string | null): Promise<Comment[]> {
  if (!sql) return [];
  await ensureSocial();
  const rows = await sql`SELECT c.*, c.created_at::text AS created_at, u.handle, u.avatar_url, COALESCE(u.nickname, u.handle, 'someone') AS nickname
                         FROM comments c LEFT JOIN users u ON u.uid = c.uid
                         WHERE c.post_id = ${postId} AND c.status = 'live' ORDER BY c.created_at LIMIT 500`;
  return rows.map((r) => ({
    id: r.id as string, postId: r.post_id as string, uid: r.uid as string, handle: (r.handle as string) ?? null,
    nickname: r.nickname as string, body: r.body as string, parentId: (r.parent_id as string) ?? null,
    createdAt: r.created_at as string, mine: !!viewer && r.uid === viewer, avatarUrl: (r.avatar_url as string) ?? null,
  }));
}

export async function commentCounts(postIds: string[]): Promise<Map<string, number>> {
  if (!sql || !postIds.length) return new Map();
  await ensureSocial();
  const rows = await sql`SELECT post_id, count(*)::int AS n FROM comments WHERE post_id = ANY(${postIds}::text[]) AND status = 'live' GROUP BY post_id`;
  return new Map(rows.map((r) => [r.post_id as string, r.n as number]));
}

export async function commentsToday(uid: string): Promise<number> {
  const db = need();
  await ensureSocial();
  const [r] = await db`SELECT count(*)::int AS n FROM comments WHERE uid = ${uid} AND created_at > now() - interval '24 hours'`;
  return r.n as number;
}

export async function addComment(c: { postId: string; uid: string; body: string; parentId: string | null }): Promise<string> {
  const db = need();
  await ensureSocial();
  const id = newId();
  // Replies stay one level deep: a reply to a reply attaches to the top comment.
  let parent = c.parentId;
  if (parent) {
    const [p] = await db`SELECT id, parent_id FROM comments WHERE id = ${parent} AND post_id = ${c.postId} AND status = 'live'`;
    parent = p ? ((p.parent_id as string) ?? (p.id as string)) : null;
  }
  await db`INSERT INTO comments (id, post_id, uid, body, parent_id) VALUES (${id}, ${c.postId}, ${c.uid}, ${c.body}, ${parent})`;
  return id;
}

/** The commenter or the post's author can delete a comment (and its replies). */
export async function deleteComment(id: string, uid: string): Promise<boolean> {
  const db = need();
  await ensureSocial();
  const [c] = await db`SELECT c.uid, p.uid AS post_uid FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ${id}`;
  if (!c || (c.uid !== uid && c.post_uid !== uid)) return false;
  await db`UPDATE comments SET status = 'deleted' WHERE id = ${id} OR parent_id = ${id}`;
  return true;
}

// ---------------------------------------------------------------- reviews
export async function addReview(r: Omit<Review, "id" | "createdAt" | "handle">): Promise<string> {
  const db = need();
  await ensureSocial();
  const id = newId();
  await db`INSERT INTO reviews (id, uid, place_id, salon_name, salon_address, maps_url, rating, body, post_id)
           VALUES (${id}, ${r.uid}, ${r.placeId}, ${r.salonName}, ${r.salonAddress}, ${r.mapsUrl}, ${r.rating}, ${r.body}, ${r.postId})`;
  return id;
}

export async function listReviews(o: { uid?: string; placeId?: string; status?: string; limit?: number }): Promise<Review[]> {
  if (!sql) return [];
  await ensureSocial();
  const rows = await sql`SELECT r.*, r.created_at::text AS created_at, u.handle FROM reviews r LEFT JOIN users u ON u.uid = r.uid
                         WHERE r.status = ${o.status ?? "live"} AND (${o.uid ?? null}::text IS NULL OR r.uid = ${o.uid ?? null})
                           AND (${o.placeId ?? null}::text IS NULL OR r.place_id = ${o.placeId ?? null})
                         ORDER BY r.created_at DESC LIMIT ${o.limit ?? 100}`;
  return rows.map((x) => ({
    id: x.id as string, uid: x.uid as string, handle: (x.handle as string) ?? null, salonName: x.salon_name as string,
    salonAddress: (x.salon_address as string) ?? null, placeId: (x.place_id as string) ?? null, mapsUrl: (x.maps_url as string) ?? null,
    rating: x.rating as number, body: x.body as string, postId: (x.post_id as string) ?? null, createdAt: x.created_at as string,
  }));
}

export async function deleteReview(id: string, uid: string): Promise<boolean> {
  const db = need();
  await ensureSocial();
  const r = await db`UPDATE reviews SET status = 'deleted' WHERE id = ${id} AND uid = ${uid} RETURNING id`;
  return r.length > 0;
}

// ---------------------------------------------------------------- reports (comments, reviews)
/** Reports from 3 different people take a comment or review down until the owner restores it in /admin/posts. */
export async function report(uid: string, kind: "comment" | "review", target: string): Promise<void> {
  const db = need();
  await ensureSocial();
  await db`INSERT INTO reports (uid, kind, target) VALUES (${uid}, ${kind}, ${target}) ON CONFLICT DO NOTHING`;
  const [r] = await db`SELECT count(*)::int AS n FROM reports WHERE kind = ${kind} AND target = ${target}`;
  if ((r.n as number) >= REPORTS_TO_REMOVE) {
    if (kind === "comment") await db`UPDATE comments SET status = 'flagged' WHERE id = ${target} AND status = 'live'`;
    else await db`UPDATE reviews SET status = 'flagged' WHERE id = ${target} AND status = 'live'`;
  }
}

export type Flagged = { kind: "comment" | "review"; id: string; body: string; who: string; where: string; reports: number };
export async function flaggedItems(): Promise<Flagged[]> {
  if (!sql) return [];
  await ensureSocial();
  const rows = await sql`
    SELECT 'comment' AS kind, c.id, c.body, COALESCE(u.handle, c.uid) AS who, '/community/' || c.post_id AS place,
           (SELECT count(*) FROM reports r WHERE r.kind = 'comment' AND r.target = c.id)::int AS reports
    FROM comments c LEFT JOIN users u ON u.uid = c.uid WHERE c.status = 'flagged'
    UNION ALL
    SELECT 'review', v.id, v.salon_name || ' (' || v.rating || '★): ' || v.body, COALESCE(u.handle, v.uid), '/u/' || COALESCE(u.handle, ''),
           (SELECT count(*) FROM reports r WHERE r.kind = 'review' AND r.target = v.id)::int
    FROM reviews v LEFT JOIN users u ON u.uid = v.uid WHERE v.status = 'flagged'`;
  return rows.map((r) => ({ kind: r.kind as "comment" | "review", id: r.id as string, body: r.body as string, who: r.who as string, where: r.place as string, reports: r.reports as number }));
}

export async function resolveFlag(kind: "comment" | "review", id: string, keep: boolean): Promise<void> {
  const db = need();
  await ensureSocial();
  const status = keep ? "live" : "removed";
  if (kind === "comment") await db`UPDATE comments SET status = ${status} WHERE id = ${id}`;
  else await db`UPDATE reviews SET status = ${status} WHERE id = ${id}`;
  if (keep) await db`DELETE FROM reports WHERE kind = ${kind} AND target = ${id}`;
}

// ---------------------------------------------------------------- account deletion
/**
 * Deletes an account and everything tied to it: posts and their photos (and others' likes and comments on them),
 * her likes, saves, comments, reviews, follows both ways, reports, preferences, history, booking requests,
 * profile and cover photos, and the account row. Comments she wrote on others' posts are removed with their replies.
 */
export async function deleteAccount(uid: string): Promise<void> {
  const db = need();
  await ensureSocial();
  const { dropImage } = await import("./community");
  const [u] = await db`SELECT email, avatar_url, cover_url FROM users WHERE uid = ${uid}`;
  const posts = await db`SELECT id, image_url FROM posts WHERE uid = ${uid}`;
  for (const p of posts) await dropImage({ id: p.id as string, imageUrl: p.image_url as string });
  for (const url of [u?.avatar_url, u?.cover_url].filter(Boolean) as string[]) {
    const id = url.startsWith("/community/img/") ? url.slice("/community/img/".length) : "x";
    await dropImage({ id, imageUrl: url });
  }
  const ids = posts.map((p) => p.id as string);
  await db`DELETE FROM post_reacts WHERE post_id = ANY(${ids}::text[]) OR uid = ${uid}`;
  await db`DELETE FROM comments WHERE post_id = ANY(${ids}::text[])
           OR parent_id IN (SELECT id FROM comments WHERE uid = ${uid}) OR uid = ${uid}`;
  await db`DELETE FROM posts WHERE uid = ${uid}`;
  await db`DELETE FROM reviews WHERE uid = ${uid}`;
  await db`DELETE FROM follows WHERE follower = ${uid} OR followee = ${uid}`;
  await db`DELETE FROM reports WHERE uid = ${uid}`;
  await db`DELETE FROM saved WHERE uid = ${uid}`;
  await db`DELETE FROM profiles WHERE uid = ${uid}`;
  await db`DELETE FROM events WHERE uid = ${uid}`;
  await db`DELETE FROM booking_requests WHERE uid = ${uid}`;
  if (u?.email) await db`DELETE FROM login_codes WHERE email = ${u.email}`;
  await db`DELETE FROM users WHERE uid = ${uid}`;
}
