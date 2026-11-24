import { BottomNav } from "@/components/BottomNav";
import { PlusIcon } from "@/components/Icons";
import { PostTile } from "@/components/PostTile";
import { buildProfile, rankForYou } from "@/lib/engine";
import { requestUid } from "@/lib/request";
import { getProfile, listSaved } from "@/lib/store";
import { listPosts, popularity } from "@/lib/store/community";
import { tasteSignals } from "@/lib/taste";

export const metadata = { title: "Community", description: "Real sets from real people. Like, save, and book the ones you love." };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "for-you", label: "For you" },
  { value: "new", label: "New" },
  { value: "popular", label: "Popular" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const STATUS_NOTE: Record<string, string> = {
  pending: "In review",
  rejected: "Not posted",
  flagged: "Under review again",
};

export default async function Community({ searchParams }: { searchParams: { sort?: string; posted?: string; deleted?: string } }) {
  const uid = requestUid();
  const tab: Tab = TABS.some((t) => t.value === searchParams.sort) ? (searchParams.sort as Tab) : "for-you";
  const [approved, mine, profile, saved, signals] = await Promise.all([
    listPosts({ status: "approved", uid, sort: tab === "popular" ? "popular" : "new", limit: 120, skipHidden: true }),
    listPosts({ byUid: uid, uid, limit: 20 }),
    getProfile(uid), listSaved(uid), tasteSignals(uid),
  ]);
  const p = buildProfile(uid, profile.onboarded ? profile : null, saved, signals);
  const posts = tab === "for-you"
    ? rankForYou(approved.map((x) => ({ ...x, popularity: popularity(x) })), p)
    : approved;
  const waiting = mine.filter((x) => x.status !== "approved");
  const justPosted = searchParams.posted ? mine.find((x) => x.id === searchParams.posted) : null;

  return (
    <div className="shell shell-wide">
      <main className="main">
        <header className="community-head">
          <div>
            <h1 className="h1">Community</h1>
            <p className="muted">Real sets from real people. Like the ones you love; save them to book later.</p>
          </div>
          <a className="btn btn-primary community-share" href="/community/new"><PlusIcon size={18} /> Share your nails</a>
        </header>

        {justPosted ? (
          <p className="notice" role="status">
            {justPosted.status === "rejected"
              ? `We couldn't post that one. ${justPosted.ai?.reason ?? ""}`
              : "Thanks for sharing! Your set is in review and usually goes live within a day."}
          </p>
        ) : searchParams.deleted ? <p className="notice" role="status">Your post was deleted.</p> : null}

        {waiting.length ? (
          <section aria-labelledby="mine" className="my-posts">
            <h2 className="h2" id="mine" style={{ fontSize: 16 }}>Your posts</h2>
            <div className="my-posts-row">
              {waiting.map((x) => (
                <a key={x.id} href={`/community/${x.id}`} className="my-post">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.imageUrl} alt="" />
                  <span className={`status status-${x.status}`}>{STATUS_NOTE[x.status]}</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <nav className="chips" aria-label="Sort">
          {TABS.map((t) => (
            <a key={t.value} className="chip" aria-pressed={t.value === tab} href={t.value === "for-you" ? "/community" : `/community?sort=${t.value}`}>{t.label}</a>
          ))}
        </nav>

        {posts.length ? (
          <div className="post-grid">
            {posts.map((x, i) => <PostTile key={x.id} post={x} priority={i < 4} />)}
          </div>
        ) : (
          <div className="empty">
            <p className="h2">Be the first to share</p>
            <p className="muted">Post a photo of your nails. Every set is checked before it goes live.</p>
            <a className="btn btn-primary" href="/community/new" style={{ flex: "none" }}>Share your nails</a>
          </div>
        )}
      </main>
      <BottomNav current="/community" />
    </div>
  );
}
