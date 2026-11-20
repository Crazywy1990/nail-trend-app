import type { Post } from "@/lib/store/community";
import { LikeButton } from "./PostButtons";

/** One community photo in the grid: photo, credit, like count. Keeps the photo's own aspect ratio (masonry). */
export function PostTile({ post, priority }: { post: Post; priority?: boolean }) {
  const ratio = post.width && post.height ? `${post.width} / ${post.height}` : "4 / 5";
  return (
    <article className="post-tile">
      <a href={`/community/${post.id}`} className="post-photo" style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.imageUrl} alt={post.caption ? `${post.nickname}'s nails: ${post.caption}` : `Nails shared by ${post.nickname}`}
          loading={priority ? "eager" : "lazy"} decoding="async" />
        <span className="post-credit">@{post.nickname}</span>
      </a>
      <div className="post-tile-bar">
        <span className="post-tile-tags">{[post.tags.finish, post.tags.colorFamily].filter(Boolean).join(" · ")}</span>
        <LikeButton postId={post.id} liked={post.liked} count={post.likes} compact />
      </div>
    </article>
  );
}
