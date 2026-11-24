import { notFound } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { FollowButton, FollowerCount } from "@/components/FollowButton";
import { PostTile } from "@/components/PostTile";
import { ReportLink } from "@/components/ReportLink";
import { Stars } from "@/components/Stars";
import { sessionUid } from "@/lib/auth";
import { requestUid } from "@/lib/request";
import { listPosts, reactedPosts } from "@/lib/store/community";
import { listReviews, profileStats, userByHandle } from "@/lib/store/social";
import { removeReview } from "@/lib/socialActions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { handle: string } }) {
  const u = await userByHandle(params.handle);
  if (!u?.handle) return { title: "Not found", robots: { index: false } };
  return { title: `${u.nickname ?? u.handle} (@${u.handle})`, description: u.bio ?? `@${u.handle}'s nail sets and salon reviews on AllTen.` };
}

const STATUS: Record<string, string> = { pending: "In review", rejected: "Not posted", flagged: "Under review" };
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function UserPage({ params, searchParams }: { params: { handle: string }; searchParams: { tab?: string; saved?: string; reviewed?: string } }) {
  const user = await userByHandle(params.handle);
  if (!user?.handle) notFound();
  const me = await sessionUid();
  const viewer = me ?? requestUid();
  const self = me === user.uid;
  const showLiked = self || user.showLikes;
  const tabs = [
    { value: "posts", label: "Posts" },
    { value: "reviews", label: "Reviews" },
    ...(showLiked ? [{ value: "liked", label: self && !user.showLikes ? "Liked · only you" : "Liked" }] : []),
  ];
  const tab = tabs.some((t) => t.value === searchParams.tab) ? searchParams.tab! : "posts";
  const stats = await profileStats(user.uid, me);
  const name = user.nickname || user.handle;
  const base = `/u/${user.handle}`;

  const posts = tab === "posts" ? await listPosts({ byUid: user.uid, uid: viewer, status: self ? undefined : "approved", limit: 120 }) : [];
  const reviews = tab === "reviews" ? await listReviews({ uid: user.uid }) : [];
  const liked = tab === "liked" ? (await reactedPosts(user.uid, ["like", "save"], 120)).map((r) => r.post) : [];
  const likedUnique = [...new Map(liked.map((p) => [p.id, p])).values()];

  return (
    <div className="shell shell-wide">
      <main className="main">
        {searchParams.saved ? <p className="notice" role="status">Profile saved.</p> : null}
        {searchParams.reviewed ? <p className="notice" role="status">Thanks! Your review is live.</p> : null}
        <header className="user-head">
          <span className="avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
          <div className="user-id">
            <h1 className="h1 user-name">{name}</h1>
            <div className="muted">@{user.handle}</div>
          </div>
        </header>
        {user.bio ? <p className="user-bio">{user.bio}</p> : null}
        <div className="user-stats">
          <a href={`${base}/follows?list=following`}><strong>{stats.following}</strong> Following</a>
          <a href={`${base}/follows?list=followers`}><strong><FollowerCount handle={user.handle} initial={stats.followers} /></strong> Followers</a>
          <span className="stat"><strong>{stats.likesAndSaves}</strong> Likes &amp; saves</span>
        </div>
        <div className="user-actions">
          {self ? (
            <>
              <a className="btn btn-sm" href="/settings">Edit profile</a>
              <a className="btn btn-sm" href="/reviews/new">Review a salon</a>
              <a className="btn btn-primary btn-sm" href="/community/new">Share your nails</a>
            </>
          ) : (
            <FollowButton handle={user.handle} following={stats.iFollow} signedIn={!!me} />
          )}
        </div>

        <nav className="chips" aria-label="Sections">
          {tabs.map((t) => (
            <a key={t.value} className="chip" aria-pressed={t.value === tab} href={t.value === "posts" ? base : `${base}?tab=${t.value}`}>
              {t.label}{t.value === "posts" ? ` ${stats.posts}` : t.value === "reviews" ? ` ${stats.reviews}` : ""}
            </a>
          ))}
        </nav>

        {tab === "posts" ? (
          posts.length ? (
            <div className="post-grid">
              {posts.map((p) => (
                <div key={p.id} className="post-tile-wrap">
                  <PostTile post={p} hideable={false} />
                  {p.status !== "approved" ? <span className={`status status-${p.status} status-top`}>{STATUS[p.status]}</span> : null}
                </div>
              ))}
            </div>
          ) : <p className="muted">{self ? "You haven't shared a set yet." : "No posts yet."}</p>
        ) : null}

        {tab === "reviews" ? (
          reviews.length ? (
            <ul className="review-list">
              {reviews.map((r) => (
                <li key={r.id} className="review-item">
                  <div className="review-top">
                    <div>
                      <strong>{r.salonName}</strong>
                      {r.salonAddress ? <div className="muted review-addr">{r.mapsUrl ? <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer">{r.salonAddress}</a> : r.salonAddress}</div> : null}
                    </div>
                    <Stars n={r.rating} />
                  </div>
                  <p className="review-text">{r.body}</p>
                  <div className="comment-actions">
                    <span className="muted" style={{ fontSize: 12 }}>{fmt(r.createdAt)}</span>
                    {r.postId ? <a className="link-btn link-sm" href={`/community/${r.postId}`}>See the set</a> : null}
                    {self ? (
                      <form action={removeReview}><input type="hidden" name="id" value={r.id} /><button className="link-btn link-sm">Delete</button></form>
                    ) : <ReportLink kind="review" id={r.id} />}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{self ? "Reviews you write about salons show up here." : "No reviews yet."}</p>
        ) : null}

        {tab === "liked" ? (
          likedUnique.length ? <div className="post-grid">{likedUnique.map((p) => <PostTile key={p.id} post={p} hideable={false} />)}</div>
            : <p className="muted">No liked sets yet.</p>
        ) : null}
      </main>
      <BottomNav current={self ? "/profile" : "/community"} />
    </div>
  );
}
