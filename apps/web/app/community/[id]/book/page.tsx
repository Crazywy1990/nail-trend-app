import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/Icons";
import { BookMessage } from "@/components/BookMessage";
import { BookingForm } from "@/components/BookingForm";
import { requestUid, siteUrl } from "@/lib/request";
import { getProfile } from "@/lib/store";
import { getPost } from "@/lib/store/community";

export const metadata = { title: "Book this set", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Book a community set: same concierge request as a look, with the post's photo as the reference. */
export default async function BookPost({ params, searchParams }: { params: { id: string }; searchParams: { sent?: string; error?: string } }) {
  const uid = requestUid();
  const post = await getPost(params.id, uid);
  if (!post || post.status !== "approved") notFound();
  const { salon } = await getProfile(uid);
  const link = `${siteUrl()}/community/${post.id}?ref=book_message&utm_source=salon_message`;
  const desc = [post.tags.length, post.tags.shape?.toLowerCase(), post.tags.colorFamily, post.tags.finish].filter(Boolean).join(" ");
  const draft = `Hi! I'd like to book ${desc ? `a ${desc} set` : "this set"} like in this photo: ${link}\n\nDo you have an opening on [day] around [time]?`;

  return (
    <div className="shell">
      <main className="main">
        <a className="back" href={`/community/${post.id}`}><ArrowLeft size={20} /> @{post.nickname}&rsquo;s set</a>
        <div className="book-look">
          <div className="post-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.imageUrl} alt={`Nails shared by ${post.nickname}`} />
          </div>
          <div>
            <div className="label">Book this set</div>
            <h1 className="h1" style={{ fontSize: 26 }}>@{post.nickname}&rsquo;s set</h1>
            {desc ? <p className="muted" style={{ margin: "6px 0 0" }}>{desc}</p> : null}
          </div>
        </div>
        {searchParams.sent ? (
          <section className="sent" role="status">
            <h2 className="h2">Request sent — we&rsquo;ll confirm by message.</h2>
            <p className="why">We&rsquo;ll find a tech who can do this set and reach out with a time.</p>
            <div className="actions-row">
              <a className="btn btn-primary" href="/community">Back to Community</a>
            </div>
          </section>
        ) : (
          <BookingForm lookId={`post:${post.id}`} error={searchParams.error} />
        )}
        <details className="own-salon">
          <summary>Or message {salon?.name ?? "your own salon"} yourself</summary>
          <p className="why">Copy this into a text or Instagram DM. The link shows your tech the photo.</p>
          <BookMessage uid={uid} lookId={`post:${post.id}`} draft={draft} salon={salon} />
        </details>
      </main>
    </div>
  );
}
