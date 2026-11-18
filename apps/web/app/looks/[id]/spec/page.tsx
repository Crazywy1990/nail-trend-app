import { wmLabel } from "@/lib/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoSlot } from "@/components/PhotoSlot";
import { isDarkTint, tintFor } from "@/lib/format";
import { TrackLanding } from "@/components/Track";
import { fetchLook } from "@/lib/api";
import { photoFor } from "@/lib/format";
import { requestUid } from "@/lib/request";

type Props = { params: { id: string }; searchParams?: { tone?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await fetchLook(params.id);
  if (!l) return { title: "Spec sheet not found" };
  const photo = photoFor(l);
  return {
    title: { absolute: `AllTen — shades for your tech · ${l.name}` },
    description: `Shape, length, shades and timing for ${l.name}.`,
    robots: { index: false },
    openGraph: { title: "AllTen — shades for your tech", description: `Can you do this set? ${l.name}`, images: photo ? [{ url: photo }] : [] },
  };
}

/** Public spec sheet for the nail tech. Opens without an account. */
export default async function SpecSheet({ params, searchParams }: Props) {
  const tone = ["light", "medium", "deep"].includes(searchParams?.tone ?? "") ? searchParams!.tone! : "medium";
  const l = await fetchLook(params.id);
  if (!l) notFound();
  const uid = requestUid();
  const anyUnverified = l.shades.some((s) => !(s.verified && s.code));

  return (
    <div className="shell">
      <main className="main">
        <div>
          <div className="label">AllTen — shades for your tech</div>
          <h1 className="h1" style={{ fontSize: 28 }}>{l.name}</h1>
        </div>
        <article className="card">
          <PhotoSlot photo={photoFor(l, tone)} ai={wmLabel(l.photoSource)} pos={l.photoPos} alt={l.photoAlt || l.name} tint={tintFor(l.colorFamily)} dark={isDarkTint(l.colorFamily)} priority />
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
                  <ul className="shade-list">
                    {l.shades.map((s) => (
                      <li key={s.name}>
                        {s.verified && s.code
                          ? <><strong>{s.brand ? `${s.brand} ${s.name}` : s.name}</strong> <span className="code">{s.code}</span></>
                          : <span>{s.brand ? `${s.brand} ${s.name}` : s.name} <span className="muted">(approximate)</span></span>}
                      </li>
                    ))}
                  </ul>
                ) : "Match from the photo"}
              </dd>
              <dt>Time</dt><dd>About {l.durationMin} min</dd>
              <dt>Typical price</dt><dd>{l.priceRange}</dd>
            </dl>
            {anyUnverified ? (
              <p className="muted" style={{ margin: 0 }}>
                Shades marked &ldquo;approximate&rdquo; don&rsquo;t have a code checked against a retailer or pro listing yet. Match by name and photo.
              </p>
            ) : null}
          </div>
        </article>
        <a className="btn btn-primary" href={`/?ref=spec_sheet`}>Find your next look on AllTen</a>
      </main>
      <TrackLanding uid={uid} lookId={l.id} />
    </div>
  );
}
