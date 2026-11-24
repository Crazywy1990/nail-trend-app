import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/Icons";
import { SalonFields } from "@/components/SalonFields";
import { currentUser } from "@/lib/auth";
import { getProfile } from "@/lib/store";
import { getPost } from "@/lib/store/community";
import { submitReview } from "@/lib/socialActions";

export const metadata = { title: "Review a salon", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewReview({ searchParams }: { searchParams: { post?: string; error?: string } }) {
  const here = `/reviews/new${searchParams.post ? `?post=${searchParams.post}` : ""}`;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);
  if (!user.handle) redirect(`/welcome?next=${encodeURIComponent(here)}`);
  const post = searchParams.post ? await getPost(searchParams.post, user.uid) : null;
  const ownPost = post && post.uid === user.uid ? post : null;
  const { salon } = await getProfile(user.uid);
  return (
    <div className="shell">
      <main className="main">
        <a className="back" href={ownPost ? `/community/${ownPost.id}` : `/u/${user.handle}?tab=reviews`}><ArrowLeft size={18} /> Back</a>
        <h1 className="h1">Review a salon</h1>
        <p className="muted">Share what it was like: the result, how long it lasted, the price, the service. Be honest and fair.</p>
        <form action={submitReview} className="onboard">
          {ownPost ? <input type="hidden" name="postId" value={ownPost.id} /> : null}
          <SalonFields salon={salon} />
          <fieldset className="star-pick">
            <legend className="label">Rating</legend>
            {[5, 4, 3, 2, 1].map((n) => (
              <label key={n} className="star-opt">
                <input type="radio" name="rating" value={n} required className="sr-only" />
                <span aria-hidden="true">{"★".repeat(n)}</span><span className="sr-only">{n} stars</span>
              </label>
            ))}
          </fieldset>
          <label className="field">Your review
            <textarea name="body" required minLength={10} maxLength={1000} rows={5} placeholder="Gel lasted 3 weeks, shape was exactly what I asked for…" />
          </label>
          {searchParams.error ? <p className="notice" role="alert">{searchParams.error}</p> : null}
          <button className="btn btn-primary">Post review</button>
        </form>
      </main>
    </div>
  );
}
