import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoSlot } from "@/components/PhotoSlot";
import { TrackLanding } from "@/components/Track";
import { fetchLook } from "@/lib/api";
import { photoFor, shadeLabel } from "@/lib/format";
import { requestUid } from "@/lib/request";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await fetchLook(params.id);
  if (!l) return { title: "Spec sheet not found" };
  const photo = photoFor(l);
  return {
    title: `Spec sheet: ${l.name}`,
    description: `Shape, length, shades and timing for ${l.name}.`,
    robots: { index: false },
    openGraph: { title: `Can you do this set? ${l.name}`, images: photo ? [{ url: photo }] : [] },
  };
}

/** Public spec sheet for the nail tech. Opens without an account. */
export default async function SpecSheet({ params }: Props) {
  const l = await fetchLook(params.id);
  if (!l) notFound();
  const uid = requestUid();
  const anyUnverified = l.shades.some((s) => s.code && !s.verified);

  return (
    <div className="shell">
      <main className="main">
        <div>
          <div className="label">Spec sheet for your nail tech</div>
          <h1 className="h1" style={{ fontSize: 28 }}>{l.name}</h1>
        </div>
        <article className="card">
          <PhotoSlot photo={photoFor(l)} pos={l.photoPos} alt={l.photoAlt || l.name} brief={l.photoBrief} priority />
          <div className="card-body">
            <dl className="dl">
              <dt>Shape</dt><dd>{l.shape}</dd>
              <dt>Length</dt><dd>{l.length}</dd>
              <dt>System</dt><dd>{l.system}</dd>
              <dt>Finish</dt><dd>{l.finish}</dd>
              <dt>Technique</dt><dd>{l.technique}</dd>
              <dt>Shades</dt>
              <dd>
                {l.shades.length ? (
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                    {l.shades.map((s) => <li key={s.name}>{shadeLabel(s)}</li>)}
                  </ul>
                ) : "Match from the photo"}
              </dd>
              <dt>Time</dt><dd>About {l.durationMin} min</dd>
              <dt>Typical price</dt><dd>{l.priceRange}</dd>
            </dl>
            {anyUnverified ? (
              <p className="muted" style={{ margin: 0 }}>
                Shades marked &ldquo;code to verify&rdquo; haven&rsquo;t been checked against the brand catalog yet. Match by name and photo.
              </p>
            ) : null}
          </div>
        </article>
        <a className="btn btn-primary" href={`/?ref=spec_sheet`}>Find your next look on Nail Trend</a>
      </main>
      <TrackLanding uid={uid} lookId={l.id} />
    </div>
  );
}
