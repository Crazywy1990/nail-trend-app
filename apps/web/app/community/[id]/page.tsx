import { notFound } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft } from "@/components/Icons";
import { LookRow } from "@/components/LookCard";
import { DeletePostButton, LikeDislike, NotInterestedButton, ReportButton, SavePostButton } from "@/components/PostButtons";
import { PostTile } from "@/components/PostTile";
import { TrackPostView } from "@/components/Track";
import { Comments } from "@/components/Comments";
import { FollowButton } from "@/components/FollowButton";
import { sessionUid } from "@/lib/auth";
import { getUser, listComments, profileStats } from "@/lib/store/social";
import { buildProfile, rankForYou, similarLooks } from "@/lib/engine";
import { requestUid } from "@/lib/request";
import { getProfile, listSaved } from "@/lib/store";
import { getPost, listPosts, popularity } from "@/lib/store/community";
import { tasteSignals } from "@/lib/taste";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const post = await getPost(params.id);
  if (!post || post.status !== "approved") return { title: "Community", robots: { index: false } };
  return {
    title: `${post.nickname}'s set`,
    description: post.caption ?? "A set shared on AllTen.",
    openGraph: { images: [{ url: post.imageUrl }] },
  };
}

const STATUS_COPY: Record<string, string> = {
  pending: "In review. Only you can see this until it's approved, usually within a day.",
  rejected: "Not posted.",
  flagged: "Taken down for another review after reports. Only you can see it for now.",
};

export default async function PostPage({ params }: { params: { id: string } }) {
  const uid = requestUid();
  const me = await sessionUid();
  const post = await getPost(params.id, uid);
  const mine = !!post && (post.uid === me || (!post.handle && post.uid === uid));
  if (!post || (post.status !== "approved" && !mine)) notFound();

  const [profile, saved, signals, others, comments, meUser, authorStats] = await Promise.all([
    getProfile(uid), listSaved(uid), tasteSignals(uid),
    listPosts({ status: "approved", uid, limit: 60, skipHidden: true }),
    listComments(post.id, me), me ? getUser(me) : null,
    post.handle ? profileStats(post.uid, me) : null,
  ]);
  const p = buildProfile(uid, profile.onboarded ? profile : null, saved, signals);
  const similar = similarLooks(post.tags, p, 3);
  const more = rankForYou(others.filter((x) => x.id !== post.id).map((x) => ({ ...x, popularity: popularity(x) })), p).slice(0, 6);
  const tags = [post.tags.colorFamily, post.tags.finish, post.tags.shape?.toLowerCase(), post.tags.length, ...post.tags.words].filter(Boolean) as string[];
  const posted = new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="shell">
      <main className="main">
        <a className="back" href="/community"><ArrowLeft size={18} /> Community</a>
        {post.status !== "approved" ? (
          <p className="notice" role="status">{STATUS_COPY[post.status]} {post.status === "rejected" && post.ai?.reason ? post.ai.reason : ""}</p>
        ) : null}
        <figure className="post-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt={post.caption ? `${post.nickname}'s nails: ${post.caption}` : `Nails shared by ${post.nickname}`}
            style={{ aspectRatio: post.width && post.height ? `${post.width} / ${post.height}` : undefined }} />
          <span className="post-credit">{post.handle ? `@${post.handle}` : post.nickname}</span>
        </figure>
        <div className="post-meta">
          <div>
            <div className="post-author">
              {post.handle ? (
                <a href={`/u/${post.handle}`} className="post-author-link">
                  <span className="avatar avatar-sm" aria-hidden="true">{post.nickname.slice(0, 1).toUpperCase()}</span>
                  <span><strong>{post.nickname}</strong> <span className="muted">@{post.handle} · {posted}</span></span>
                </a>
              ) : <span><strong>{post.nickname}</strong> <span className="muted">· {posted}</span></span>}
              {post.handle && !mine && authorStats ? <FollowButton handle={post.handle} following={authorStats.iFollow} signedIn={!!me} small /> : null}
            </div>
            {post.caption ? <p className="post-caption">{post.caption}</p> : null}
          </div>
          {post.status === "approved" ? (
            <div className="post-react-row">
              <LikeDislike postId={post.id} liked={post.liked} disliked={post.disliked} count={post.likes} />
              <SavePostButton postId={post.id} saved={post.saved} />
            </div>
          ) : null}
        </div>
        {tags.length ? <div className="facts">{tags.map((t) => <span key={t} className="fact">{t}</span>)}</div> : null}

        {post.status === "approved" ? (
          <div className="post-cta">
            <a className="btn btn-primary" href={`/community/${post.id}/book`}>Book this set</a>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>We send this photo to the salon as your reference and confirm the time with you.</p>
          </div>
        ) : null}

        {mine && post.status === "approved" ? (
          <a className="link-btn" href={`/reviews/new?post=${post.id}`}>★ Review the salon that did this</a>
        ) : null}

        {post.status === "approved" ? (
          <Comments postId={post.id} initial={comments} canComment={!!meUser?.handle} needsHandle={!!meUser && !meUser.handle} isPostAuthor={mine} />
        ) : null}

        {similar.length ? (
          <section className="rows" aria-labelledby="similar">
            <h2 className="h2" id="similar" style={{ fontSize: 18 }}>Closest looks with a full spec</h2>
            <p className="muted" style={{ margin: 0 }}>Exact shades, technique, price and time, ready to book.</p>
            <div className="rows-list">
              {similar.map((l, i) => (
                <LookRow key={l.id} kicker={l.colorFamily === post.tags.colorFamily && l.finish === post.tags.finish ? "Closest match" : "Similar"} pick={{ look: l, slot: "for_you", position: i, relevance: 0, why: "", photo: l.photoBySkinTone?.[profile.skinTone] ?? l.photoBySkinTone?.medium ?? null }} />
              ))}
            </div>
          </section>
        ) : null}

        {more.length ? (
          <section aria-labelledby="more" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 className="h2" id="more" style={{ fontSize: 18 }}>More you might like</h2>
            <div className="post-grid post-grid-sm">{more.map((x) => <PostTile key={x.id} post={x} />)}</div>
          </section>
        ) : null}

        <div className="post-footer">
          {mine ? <DeletePostButton postId={post.id} /> : post.status === "approved" ? (
            <>
              <NotInterestedButton postId={post.id} hidden={post.hidden} />
              <ReportButton postId={post.id} />
            </>
          ) : null}
        </div>
      </main>
      <BottomNav current="/community" />
      {post.status === "approved" ? <TrackPostView uid={uid} postId={post.id} /> : null}
    </div>
  );
}
