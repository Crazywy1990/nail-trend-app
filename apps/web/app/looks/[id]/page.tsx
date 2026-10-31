import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft } from "@/components/Icons";
import { PhotoSlot } from "@/components/PhotoSlot";
import { ProofStrip } from "@/components/ProofStrip";
import { ShareToTech } from "@/components/ShareToTech";
import { TrackLanding } from "@/components/Track";
import { fetchLook } from "@/lib/api";
import { metaLine, photoFor, specLine } from "@/lib/format";
import { requestUid } from "@/lib/request";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await fetchLook(params.id);
  if (!l) return { title: "Look not found" };
  const photo = photoFor(l);
  const description = `${l.technique}. ${metaLine(l)}. See the shades and send the spec to your nail tech.`;
  return {
    title: l.name,
    description,
    alternates: { canonical: `/looks/${l.id}` },
    openGraph: { title: l.name, description, type: "article", images: photo ? [{ url: photo, alt: l.photoAlt || l.name }] : [] },
    twitter: { card: photo ? "summary_large_image" : "summary", title: l.name, description },
  };
}

/** Public look page: the landing spot for Pinterest pins, bio links and Google results. No login. */
export default async function LookPage({ params }: Props) {
  const l = await fetchLook(params.id);
  if (!l) notFound();
  const uid = requestUid();

  return (
    <div className="shell">
      <main className="main">
        <a className="back" href="/"><ArrowLeft size={20} /> Discover</a>
        <article className="card">
          <PhotoSlot photo={photoFor(l)} pos={l.photoPos} alt={l.photoAlt || l.name} brief={l.photoBrief} priority />
          <div className="card-body">
            <ProofStrip proof={l.trendProof} />
            <h1 className="card-title" style={{ fontSize: 26 }}>{l.name}</h1>
            <div className="muted">{metaLine(l)}</div>
            <p className="why">{l.technique}.</p>
            <div className="spec">
              <div className="label">Shades for your tech</div>
              <div className="spec-text">{specLine(l)}</div>
            </div>
            <div className="actions">
              <a className="btn btn-primary" href={`/looks/${l.id}/book`}>Book this look</a>
              <div className="actions-row">
                <ShareToTech uid={uid} lookId={l.id} lookName={l.name} />
                <a className="btn" href="/">More looks for me</a>
              </div>
            </div>
          </div>
        </article>
      </main>
      <BottomNav current="" />
      <TrackLanding uid={uid} lookId={l.id} />
    </div>
  );
}
