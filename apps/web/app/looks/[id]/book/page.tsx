import { wmLabel } from "@/lib/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/Icons";
import { BookMessage } from "@/components/BookMessage";
import { BookingForm } from "@/components/BookingForm";
import { PhotoSlot } from "@/components/PhotoSlot";
import { fetchLook } from "@/lib/api";
import { getTech } from "@/lib/engine";
import { factChips, isDarkTint, photoFor, shadeLabel, tintFor } from "@/lib/format";
import { requestUid, siteUrl } from "@/lib/request";
import { getProfile } from "@/lib/store";

type Props = { params: { id: string }; searchParams: { tech?: string; sent?: string; error?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await fetchLook(params.id);
  return { title: l ? `Book ${l.name}` : "Look not found", robots: { index: false } };
}

/**
 * Book this look (concierge phase): a booking request stored with the look (and tech, if chosen);
 * the AllTen team confirms by message. Messaging her own salon stays available below.
 */
export default async function BookPage({ params, searchParams }: Props) {
  const l = await fetchLook(params.id);
  if (!l) notFound();
  const uid = requestUid();
  const { salon, skinTone } = await getProfile(uid);
  const tech = searchParams.tech ? getTech(searchParams.tech) : null;
  const specUrl = `${siteUrl()}/looks/${l.id}/spec?ref=book_message&utm_source=salon_message${skinTone !== "medium" ? `&tone=${skinTone}` : ""}`;
  const shades = l.shades.length ? l.shades.map(shadeLabel).join(", ") : "matched from the photo";
  const draft =
    `Hi! I'd like to book a ${l.length} ${l.shape.toLowerCase()} ${l.system} set: ${l.name}. ` +
    `Shades: ${shades}. It should take about ${l.durationMin} min. ` +
    `Reference photo and specs: ${specUrl}\n\nDo you have an opening on [day] around [time]?`;

  return (
    <div className="shell">
      <main className="main">
        <a className="back" href={tech ? `/techs/${tech.slug}` : `/looks/${l.id}`}><ArrowLeft size={20} /> {tech ? tech.name : l.name}</a>
        <div className="book-look">
          <PhotoSlot photo={photoFor(l, skinTone)} ai={wmLabel(l.photoSource)} pos={l.photoPos} alt={l.photoAlt || l.name} tint={tintFor(l.colorFamily)} dark={isDarkTint(l.colorFamily)} />
          <div>
            <div className="label">Book exactly this</div>
            <h1 className="h1" style={{ fontSize: 26 }}>{l.name}</h1>
            <div className="facts">{factChips(l).map((f) => <span key={f} className="fact">{f}</span>)}</div>
            {tech ? <p className="muted" style={{ margin: "6px 0 0" }}>With {tech.name}{tech.placeholder ? " (sample profile)" : ""}, {tech.city}</p> : null}
          </div>
        </div>

        {searchParams.sent ? (
          <section className="sent" role="status">
            <h2 className="h2">Request sent — we&rsquo;ll confirm by message.</h2>
            <p className="why">We&rsquo;ll reach out with a time for {l.name}. Your tech gets the photo, exact shades and timing.</p>
            <div className="actions-row">
              <a className="btn btn-primary" href="/">Back to Discover</a>
              <a className="btn" href={`/looks/${l.id}`}>See the spec</a>
            </div>
          </section>
        ) : (
          <BookingForm lookId={l.id} tech={tech?.slug ?? null} error={searchParams.error} />
        )}

        <details className="own-salon">
          <summary>Or message {salon?.name ?? "your own salon"} yourself</summary>
          <p className="why">Copy this into a text or Instagram DM. Your tech gets the photo and exact specs from the link.</p>
          <BookMessage uid={uid} lookId={l.id} draft={draft} salon={salon} />
          {!salon ? <p className="muted"><a href="/salons">Add your salon</a> to send this straight to their booking page, Instagram or phone.</p> : null}
        </details>
      </main>
    </div>
  );
}
