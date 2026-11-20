import type { TasteSignals } from "./engine";
import { recentlyViewed } from "./store";
import { reactedPosts } from "./store/community";

/** Her behavior as ranking signals: recently viewed looks, and community sets she liked (1) or saved (2). */
export async function tasteSignals(uid: string): Promise<TasteSignals> {
  const [hist, reacted] = await Promise.all([recentlyViewed(uid, 40), reactedPosts(uid)]);
  return {
    viewed: hist.filter((h) => h.kind === "look").map((h) => h.ref),
    posts: reacted.map((r) => ({ ...r.post.tags, weight: r.kind === "save" ? 2 : 1 })),
  };
}
