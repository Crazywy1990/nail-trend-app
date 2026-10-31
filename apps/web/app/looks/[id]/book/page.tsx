import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/Icons";
import { BookMessage } from "@/components/BookMessage";
import { fetchLook } from "@/lib/api";
import { shadeLabel } from "@/lib/format";
import { requestUid, siteUrl } from "@/lib/request";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await fetchLook(params.id);
  return { title: l ? `Book ${l.name}` : "Look not found", robots: { index: false } };
}

/**
 * Booking, level 2: a drafted message she sends to her own salon by text or DM.
 * Works with every salon, including the ~43% with no online booking.
 */
export default async function BookPage({ params }: Props) {
  const l = await fetchLook(params.id);
  if (!l) notFound();
  const uid = requestUid();
  const specUrl = `${siteUrl()}/looks/${l.id}/spec?ref=book_message&utm_source=salon_message`;
  const shades = l.shades.length ? l.shades.map(shadeLabel).join(", ") : "matched from the photo";
  const draft =
    `Hi! I'd like to book a ${l.length} ${l.shape.toLowerCase()} ${l.system} set: ${l.name}. ` +
    `Shades: ${shades}. It should take about ${l.durationMin} min. ` +
    `Reference photo and specs: ${specUrl}\n\nDo you have an opening on [day] around [time]?`;

  return (
    <div className="shell">
      <main className="main">
        <a className="back" href={`/looks/${l.id}`}><ArrowLeft size={20} /> {l.name}</a>
        <header>
          <div className="label">Book this look</div>
          <h1 className="h1" style={{ fontSize: 28 }}>Send this to your salon</h1>
        </header>
        <p className="why">
          Edit the day and time, then copy it into a text or Instagram DM to your salon. Your tech gets the photo and exact specs from the link.
        </p>
        <BookMessage uid={uid} lookId={l.id} draft={draft} />
        <p className="muted">Booking straight from the app, and finding a salon near you, come next.</p>
      </main>
    </div>
  );
}
