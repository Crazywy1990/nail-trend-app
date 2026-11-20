import { notFound } from "next/navigation";
import { reviewPost } from "@/lib/adminActions";
import { communityCounts, listPosts, type Post, type PostStatus } from "@/lib/store/community";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community review", robots: { index: false, follow: false } };

const VIEWS: Record<string, { label: string; status: PostStatus[] }> = {
  queue: { label: "To review", status: ["pending", "flagged"] },
  rejected: { label: "Rejected", status: ["rejected"] },
  approved: { label: "Live", status: ["approved"] },
};
const VERDICT: Record<string, string> = { pass: "AI: looks fine", review: "AI: check this", reject: "AI: reject" };

/** Community review queue. Open with ?key=<ADMIN_KEY>. Nothing is public until approved here. */
export default async function AdminPosts({ searchParams }: { searchParams: { key?: string; view?: string } }) {
  const key = process.env.ADMIN_KEY;
  if (!key || searchParams.key !== key) notFound();
  const view = VIEWS[searchParams.view ?? ""] ? searchParams.view! : "queue";
  const [posts, counts] = await Promise.all([listPosts({ status: VIEWS[view].status, limit: 200 }), communityCounts()]);
  const k = encodeURIComponent(key);

  return (
    <div className="shell shell-wide">
      <main className="main">
        <h1 className="h1" id="q">Community review</h1>
        <p className="muted">
          {counts ? `${counts.pending ?? 0} waiting · ${counts.flagged ?? 0} reported · ${counts.approved ?? 0} live · ${counts.rejected ?? 0} rejected · ` : ""}
          <a href={`/admin/requests?key=${k}`}>Booking requests</a>
        </p>
        <nav className="chips" aria-label="Views">
          {Object.entries(VIEWS).map(([v, { label }]) => (
            <a key={v} className="chip" aria-pressed={v === view} href={`/admin/posts?key=${k}&view=${v}`}>{label}</a>
          ))}
        </nav>
        {posts.length ? (
          <div className="review-grid">
            {posts.map((p) => <ReviewCard key={p.id} post={p} adminKey={key} view={view} />)}
          </div>
        ) : <p className="muted">Nothing here.</p>}
      </main>
    </div>
  );
}

function ReviewCard({ post: p, adminKey, view }: { post: Post; adminKey: string; view: string }) {
  const tags = [p.tags.colorFamily, p.tags.finish, p.tags.shape, p.tags.length, ...p.tags.words].filter(Boolean).join(" · ");
  return (
    <article className={`review-card verdict-${p.ai?.verdict ?? "review"}`}>
      <a href={p.imageUrl} target="_blank" rel="noopener noreferrer" className="review-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.imageUrl} alt="" loading="lazy" />
      </a>
      <div className="review-body">
        <div><strong>@{p.nickname}</strong> <span className="muted">· {p.createdAt.slice(0, 16).replace("T", " ")} · {p.status}{p.reports ? ` · ${p.reports} reports` : ""}</span></div>
        {p.caption ? <p style={{ margin: 0 }}>{p.caption}</p> : null}
        <p className="review-ai">
          <strong>{p.ai ? (p.ai.checked ? VERDICT[p.ai.verdict] : "AI check off") : "No AI check"}</strong>
          {p.ai?.reason ? ` — ${p.ai.reason}` : ""}
          {p.ai?.notes.length ? <><br /><span className="muted">{p.ai.notes.join(" · ")}</span></> : null}
        </p>
        {tags ? <p className="muted" style={{ margin: 0 }}>Tags: {tags}</p> : null}
        <form action={reviewPost} className="review-actions">
          <input type="hidden" name="key" value={adminKey} />
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="view" value={view} />
          {p.status !== "approved" ? <button className="btn btn-primary btn-sm" name="decision" value="approve">Approve</button> : null}
          {p.status !== "rejected" ? <button className="btn btn-sm" name="decision" value="reject">{p.status === "approved" ? "Take down" : "Reject"}</button> : null}
        </form>
      </div>
    </article>
  );
}
