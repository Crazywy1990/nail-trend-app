import { wmLabel } from "@/lib/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft } from "@/components/Icons";
import { ProofStrip } from "@/components/ProofStrip";
import { ShadeList } from "@/components/ShadeList";
import { ShareToTech } from "@/components/ShareToTech";
import { TonePhoto } from "@/components/ToneToggle";
import { TrackLanding, TrackView } from "@/components/Track";
import { SaveButton } from "@/components/SaveButton";
import { fetchLook } from "@/lib/api";
import { factChips, isDarkTint, metaLine, styleLine, tintFor } from "@/lib/format";
import { getProfile, listSaved } from "@/lib/store";
import { requestUid } from "@/lib/request";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await fetchLook(params.id);
  if (!l) return { title: "Look not found" };
  const description = `${l.technique}. ${metaLine(l)}. See it. Book exactly it.`;
  const card = `/looks/${l.id}/card`;
  return {
    title: l.name,
    description,
    alternates: { canonical: `/looks/${l.id}` },
    openGraph: { title: l.name, description, type: "article", images: [{ url: card, width: 1080, height: 1350, alt: l.photoAlt || l.name }] },
    twitter: { card: "summary_large_image", title: l.name, description, images: [card] },
  };
}

/** A look as an executable spec: photo on her hand tone, proof, exact shades, honest time and price, book or share. */
export default async function LookPage({ params }: Props) {
  const l = await fetchLook(params.id);
  if (!l) notFound();
  const uid = requestUid();
  const [profile, saved] = await Promise.all([getProfile(uid), listSaved(uid)]);
  const r = l.resultPhoto;

  return (
    <div className="shell">
      <main className="main">
        <a className="back" href="/"><ArrowLeft size={20} /> Discover</a>
        <article className="card detail">
          <div className="detail-media">
            <TonePhoto uid={uid} lookId={l.id} photos={l.photoBySkinTone} initial={profile.skinTone} pos={l.photoPos}
              alt={l.photoAlt || l.name} ai={wmLabel(l.photoSource)} tint={tintFor(l.colorFamily)} dark={isDarkTint(l.colorFamily)} priority />
            <SaveButton uid={uid} lookId={l.id} initial={saved.includes(l.id)} />
          </div>
          <div className="card-body">
            <ProofStrip look={l} />
            <h1 className="card-title" style={{ fontSize: 26 }}>{l.name}</h1>
            <div className="facts">
              {factChips(l).map((f) => <span key={f} className="fact">{f}</span>)}
              <span className="muted">{styleLine(l)}</span>
            </div>

            {r ? (
              <section className="asked-got" aria-label="Asked for and got">
                <figure>
                  <div className="ag-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.photoBySkinTone?.[profile.skinTone] ?? l.photoBySkinTone?.medium ?? ""} alt={`Asked for: ${l.name}`} />
                  </div>
                  <figcaption>Asked for</figcaption>
                </figure>
                <span className="ag-arrow" aria-hidden="true">→</span>
                <figure>
                  <div className="ag-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.src} alt={r.alt} />
                  </div>
                  <figcaption>Got{r.caption ? ` · ${r.caption}` : ""}</figcaption>
                </figure>
              </section>
            ) : null}

            <p className="why">{l.technique}.</p>
            <ShadeList look={l} />
            <div className="actions">
              <a className="btn btn-primary" href={`/looks/${l.id}/book`}>Book this look</a>
              <div className="actions-row">
                <ShareToTech uid={uid} lookId={l.id} lookName={l.name} tone={profile.skinTone} />
                <a className="btn" href="/">More looks for me</a>
              </div>
            </div>
          </div>
        </article>
      </main>
      <BottomNav current="" />
      <TrackLanding uid={uid} lookId={l.id} />
      <TrackView uid={uid} lookId={l.id} />
    </div>
  );
}
