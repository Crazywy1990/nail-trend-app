import type { TasteSignals } from "./engine";
import { recentlyViewed } from "./store";
import { reactedPosts } from "./store/community";

/** Save > like; thumbs-down pushes away harder than "not interested". */
const WEIGHT: Record<string, number> = { save: 2, like: 1, hide: -1, dislike: -1.5 };

/** Her behavior as ranking signals: recently viewed looks, and community sets she saved (2), liked (1), marked not interested (-1) or thumbed down (-1.5). */
export async function tasteSignals(uid: string): Promise<TasteSignals> {
  const [hist, reacted] = await Promise.all([recentlyViewed(uid, 40), reactedPosts(uid, ["like", "save", "dislike", "hide"])]);
  return {
    viewed: hist.filter((h) => h.kind === "look").map((h) => h.ref),
    posts: reacted.map((r) => ({ ...r.post.tags, weight: WEIGHT[r.kind] ?? 0 })),
  };
}
