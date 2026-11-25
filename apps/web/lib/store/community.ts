/**
 * Community posts: photos people upload of their own sets.
 * Flow: upload → AI pre-check (lib/moderation) → "pending" → the owner approves in /admin/posts → "approved" (public).
 * Likes, saves and reports live in post_reacts. Photos live in Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * otherwise in Postgres (post_images), otherwise in memory (local dev only).
 */
import { db as sql, ensureSchema } from "./index";
import { ensureSocial } from "./social";

export type PostStatus = "pending" | "approved" | "rejected" | "flagged";
export type PostTags = { colorFamily: string | null; finish: string | null; shape: string | null; length: string | null; words: string[] };
export type AiCheck = {
  checked: boolean;
  verdict: "pass" | "review" | "reject";
  reason: string | null;
  notes: string[];
  model?: string;
};
export type Post = {
  id: string; uid: string; nickname: string; imageUrl: string; width: number; height: number;
  caption: string | null; tags: PostTags; ai: AiCheck | null; status: PostStatus;
  createdAt: string; likes: number; saves: number; reports: number; liked: boolean; saved: boolean;
  /** Her private signals: thumbs-down, and "not interested" (hidden from her feeds). Never shown to others. */
  disliked: boolean; hidden: boolean;
  /** Author's @handle when she has an account (links to /u/handle). */
  handle: string | null;
  avatarUrl: string | null;
};
export type ReactKind = "like" | "save" | "report" | "dislike" | "hide";

/** Reports from this many different people take a post down until it is reviewed again. */
export const REPORTS_TO_HIDE = 3;
/** Uploads per person per day. */
export const DAILY_UPLOADS = 5;

// ---------------------------------------------------------------- memory fallback (no database: local dev)
type MemPost = Omit<Post, "likes" | "saves" | "reports" | "liked" | "saved" | "disliked" | "hidden" | "handle" | "avatarUrl">;
type Mem = { posts: MemPost[]; reacts: Map<string, number>; images: Map<string, { data: Buffer; type: string }> };
const g = globalThis as unknown as { __alltenCommunity?: Mem };
const mem = (): Mem => (g.__alltenCommunity ??= { posts: [] as MemPost[], reacts: new Map(), images: new Map() });
const rkey = (uid: string, postId: string, kind: ReactKind) => `${uid}|${postId}|${kind}`;
function memDecorate(p: MemPost, uid: string | null): Post {
  const count = (k: ReactKind) => [...mem().reacts.keys()].filter((x) => x.endsWith(`|${p.id}|${k}`)).length;
  return {
    ...p, likes: count("like"), saves: count("save"), reports: count("report"),
    liked: !!uid && mem().reacts.has(rkey(uid, p.id, "like")),
    saved: !!uid && mem().reacts.has(rkey(uid, p.id, "save")),
    disliked: !!uid && mem().reacts.has(rkey(uid, p.id, "dislike")),
    hidden: !!uid && mem().reacts.has(rkey(uid, p.id, "hide")),
    handle: null, avatarUrl: null,
  };
}

/** All community and account tables are created together in ensureSocial (lib/store/social). */
export const ensureCommunity = () => ensureSocial();

type Row = Record<string, unknown>;
function fromRow(r: Row): Post {
  return {
    id: r.id as string, uid: r.uid as string, nickname: r.nickname as string, imageUrl: r.image_url as string,
    width: Number(r.width) || 0, height: Number(r.height) || 0, caption: (r.caption as string) ?? null,
    tags: { colorFamily: null, finish: null, shape: null, length: null, words: [], ...(r.tags as Partial<PostTags>) },
    ai: (r.ai as AiCheck) ?? null, status: r.status as PostStatus, createdAt: r.created_at as string,
    likes: Number(r.likes) || 0, saves: Number(r.saves) || 0, reports: Number(r.reports) || 0,
    liked: !!r.liked, saved: !!r.saved, disliked: !!r.disliked, hidden: !!r.hidden, handle: (r.handle as string) ?? null, avatarUrl: (r.avatar_url as string) ?? null,
  };
}

export const newPostId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

// ---------------------------------------------------------------- images
/** Stores the processed photo and returns the URL to show it at. */
export async function storeImage(id: string, data: Buffer, type: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const ext = type === "image/webp" ? "webp" : "jpg";
    const blob = await put(`community/${id}.${ext}`, data, { access: "public", contentType: type, addRandomSuffix: true });
    return blob.url;
  }
  if (sql) {
    await ensureCommunity();
    await sql`INSERT INTO post_images (id, type, data) VALUES (${id}, ${type}, ${data.toString("base64")})`;
  } else {
    mem().images.set(id, { data, type });
  }
  return `/community/img/${id}`;
}

export async function readImage(id: string): Promise<{ data: Buffer; type: string } | null> {
  if (sql) {
    await ensureCommunity();
    const [r] = await sql`SELECT type, data FROM post_images WHERE id = ${id}`;
    return r ? { type: r.type as string, data: Buffer.from(r.data as string, "base64") } : null;
  }
  return mem().images.get(id) ?? null;
}

async function dropImage(p: Pick<Post, "id" | "imageUrl">) {
  try {
    if (p.imageUrl.startsWith("https://") && process.env.BLOB_READ_WRITE_TOKEN) {
      const { del } = await import("@vercel/blob");
      await del(p.imageUrl);
    } else if (sql) {
      await sql`DELETE FROM post_images WHERE id = ${p.id}`;
    } else {
      mem().images.delete(p.id);
    }
  } catch (e) {
    console.error("[allten] image delete failed", e);
  }
}

// ---------------------------------------------------------------- posts
export async function createPost(p: {
  id: string; uid: string; nickname: string; imageUrl: string; width: number; height: number;
  caption: string | null; tags: PostTags; ai: AiCheck; status: PostStatus;
}): Promise<void> {
  if (sql) {
    await ensureCommunity();
    await sql`INSERT INTO posts (id, uid, nickname, image_url, width, height, caption, tags, ai, status)
              VALUES (${p.id}, ${p.uid}, ${p.nickname}, ${p.imageUrl}, ${p.width}, ${p.height}, ${p.caption},
                      ${JSON.stringify(p.tags)}::jsonb, ${JSON.stringify(p.ai)}::jsonb, ${p.status})`;
    return;
  }
  mem().posts.unshift({ ...p, createdAt: new Date().toISOString() });
}

export async function uploadsToday(uid: string): Promise<number> {
  if (sql) {
    await ensureCommunity();
    const [r] = await sql`SELECT count(*)::int AS n FROM posts WHERE uid = ${uid} AND created_at > now() - interval '24 hours'`;
    return r.n as number;
  }
  return mem().posts.filter((p) => p.uid === uid && Date.now() - Date.parse(p.createdAt) < 86_400_000).length;
}

export type ListOpts = {
  status?: PostStatus | PostStatus[]; uid?: string | null; byUid?: string; byUids?: string[]; sort?: "new" | "popular"; limit?: number; ids?: string[];
  /** Leave out posts the viewer (uid) marked "not interested". */
  skipHidden?: boolean;
};

/** Posts with like/save/report counts, plus whether `uid` liked or saved each one. */
export async function listPosts(o: ListOpts = {}): Promise<Post[]> {
  const statuses = o.status ? (Array.isArray(o.status) ? o.status : [o.status]) : null;
  const limit = o.limit ?? 60;
  const viewer = o.uid ?? "";
  if (sql) {
    try {
      await ensureCommunity();
      const rows = await sql`
        SELECT p.*, p.created_at::text AS created_at, u.handle, u.avatar_url, COALESCE(u.nickname, p.nickname) AS nickname,
          (SELECT count(*) FROM post_reacts r WHERE r.post_id = p.id AND r.kind = 'like')::int AS likes,
          (SELECT count(*) FROM post_reacts r WHERE r.post_id = p.id AND r.kind = 'save')::int AS saves,
          (SELECT count(*) FROM post_reacts r WHERE r.post_id = p.id AND r.kind = 'report')::int AS reports,
          EXISTS (SELECT 1 FROM post_reacts r WHERE r.post_id = p.id AND r.uid = ${viewer} AND r.kind = 'like') AS liked,
          EXISTS (SELECT 1 FROM post_reacts r WHERE r.post_id = p.id AND r.uid = ${viewer} AND r.kind = 'save') AS saved,
          EXISTS (SELECT 1 FROM post_reacts r WHERE r.post_id = p.id AND r.uid = ${viewer} AND r.kind = 'dislike') AS disliked,
          EXISTS (SELECT 1 FROM post_reacts r WHERE r.post_id = p.id AND r.uid = ${viewer} AND r.kind = 'hide') AS hidden
        FROM posts p LEFT JOIN users u ON u.uid = p.uid
        WHERE (${statuses}::text[] IS NULL OR p.status = ANY(${statuses}::text[]))
          AND (${o.byUid ?? null}::text IS NULL OR p.uid = ${o.byUid ?? null})
          AND (${o.byUids ?? null}::text[] IS NULL OR p.uid = ANY(${o.byUids ?? null}::text[]))
          AND (${o.ids ?? null}::text[] IS NULL OR p.id = ANY(${o.ids ?? null}::text[]))
        ORDER BY p.created_at DESC LIMIT ${limit}`;
      const posts = rows.map(fromRow).filter((x) => !(o.skipHidden && x.hidden));
      return o.sort === "popular" ? posts.sort((a, b) => popularity(b) - popularity(a)) : posts;
    } catch (e) {
      console.error("[allten] posts read failed", e);
      return [];
    }
  }
  const posts = mem().posts
    .filter((p) => (!statuses || statuses.includes(p.status)) && (!o.byUid || p.uid === o.byUid) && (!o.byUids || o.byUids.includes(p.uid)) && (!o.ids || o.ids.includes(p.id)))
    .slice(0, limit).map((p) => memDecorate(p, viewer)).filter((x) => !(o.skipHidden && x.hidden));
  return o.sort === "popular" ? posts.sort((a, b) => popularity(b) - popularity(a)) : posts;
}

/** Likes and saves, fading over about two weeks so new sets get a chance. */
export function popularity(p: Post): number {
  const days = (Date.now() - Date.parse(p.createdAt)) / 86_400_000;
  return (p.likes + 2 * p.saves + 1) / Math.pow(days + 2, 0.8);
}

export async function getPost(id: string, uid: string | null = null): Promise<Post | null> {
  if (!/^[a-z0-9]{6,24}$/.test(id)) return null;
  const [p] = await listPosts({ ids: [id], uid, limit: 1 });
  return p ?? null;
}

export async function setPostStatus(id: string, status: PostStatus): Promise<void> {
  if (sql) {
    await ensureCommunity();
    await sql`UPDATE posts SET status = ${status}, reviewed_at = now() WHERE id = ${id}`;
    // A post put back up after review starts with a clean report count.
    if (status === "approved") await sql`DELETE FROM post_reacts WHERE post_id = ${id} AND kind = 'report'`;
    return;
  }
  const p = mem().posts.find((x) => x.id === id);
  if (p) p.status = status;
  if (status === "approved") [...mem().reacts.keys()].filter((k) => k.endsWith(`|${id}|report`)).forEach((k) => mem().reacts.delete(k));
}

/** Only the person who posted it (same browser) can delete it. */
export async function deletePost(id: string, uid: string): Promise<boolean> {
  const p = await getPost(id, uid);
  if (!p || p.uid !== uid) return false;
  if (sql) {
    await sql`DELETE FROM post_reacts WHERE post_id = ${id}`;
    await sql`DELETE FROM posts WHERE id = ${id}`;
  } else {
    mem().posts = mem().posts.filter((x) => x.id !== id);
  }
  await dropImage(p);
  return true;
}

/** Like, save or report. Returns the post's new counts. Enough reports take an approved post down for review. */
export async function setReact(uid: string, postId: string, kind: ReactKind, on: boolean): Promise<{ likes: number; saves: number } | null> {
  const p = await getPost(postId, uid);
  if (!p || p.status !== "approved") return null;
  // Like and thumbs-down cancel each other.
  const opposite: ReactKind | null = on && kind === "like" ? "dislike" : on && kind === "dislike" ? "like" : null;
  if (sql) {
    await ensureCommunity();
    if (opposite) await sql`DELETE FROM post_reacts WHERE uid = ${uid} AND post_id = ${postId} AND kind = ${opposite}`;
    if (on) await sql`INSERT INTO post_reacts (uid, post_id, kind) VALUES (${uid}, ${postId}, ${kind}) ON CONFLICT DO NOTHING`;
    else await sql`DELETE FROM post_reacts WHERE uid = ${uid} AND post_id = ${postId} AND kind = ${kind}`;
  } else {
    if (opposite) mem().reacts.delete(rkey(uid, postId, opposite));
    if (on) mem().reacts.set(rkey(uid, postId, kind), Date.now());
    else mem().reacts.delete(rkey(uid, postId, kind));
  }
  const after = (await getPost(postId, uid))!;
  if (kind === "report" && on && after.reports >= REPORTS_TO_HIDE) await setPostStatus(postId, "flagged");
  return { likes: after.likes, saves: after.saves };
}

/** Approved posts this person liked or saved (newest first). Saves count double for her taste. */
export async function reactedPosts(uid: string, kinds: ReactKind[] = ["like", "save"], limit = 60): Promise<{ post: Post; kind: ReactKind }[]> {
  let refs: { post_id: string; kind: ReactKind }[];
  if (sql) {
    try {
      await ensureCommunity();
      refs = (await sql`SELECT post_id, kind FROM post_reacts WHERE uid = ${uid} AND kind = ANY(${kinds}::text[])
                        ORDER BY created_at DESC LIMIT ${limit}`) as { post_id: string; kind: ReactKind }[];
    } catch (e) {
      console.error("[allten] reacts read failed", e);
      return [];
    }
  } else {
    refs = [...mem().reacts.entries()].sort((a, b) => b[1] - a[1])
      .map(([k]) => k.split("|")).filter(([u, , k]) => u === uid && kinds.includes(k as ReactKind))
      .slice(0, limit).map(([, post_id, kind]) => ({ post_id, kind: kind as ReactKind }));
  }
  if (!refs.length) return [];
  const posts = new Map((await listPosts({ ids: [...new Set(refs.map((r) => r.post_id))], uid, status: "approved", limit })).map((p) => [p.id, p]));
  return refs.filter((r) => posts.has(r.post_id)).map((r) => ({ post: posts.get(r.post_id)!, kind: r.kind }));
}

export async function communityCounts(): Promise<Record<string, number> | null> {
  if (!sql) return null;
  try {
    await ensureCommunity();
    const rows = await sql`SELECT status, count(*)::int AS n FROM posts GROUP BY status`;
    return Object.fromEntries(rows.map((r) => [r.status as string, r.n as number]));
  } catch {
    return null;
  }
}
