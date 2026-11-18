import { wmLabel } from "@/lib/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { PhotoSlot } from "@/components/PhotoSlot";
import { getTech, looksForTech } from "@/lib/engine";
import { factChips, isDarkTint, photoFor, tintFor } from "@/lib/format";
import { requestUid } from "@/lib/request";
import { getProfile } from "@/lib/store";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTech(params.slug);
  return t ? { title: `${t.name} · bookable looks`, description: `${t.name}, ${t.city}: looks you can book exactly, with shades, time and price.`, robots: t.placeholder ? { index: false } : undefined } : { title: "Tech not found" };
}

/** A partner tech's menu: every look they can do exactly, with photo, price and time, each bookable. */
export default async function TechPage({ params }: Props) {
  const tech = getTech(params.slug);
  if (!tech) notFound();
  const { skinTone } = await getProfile(requestUid());
  const looks = looksForTech(tech.slug);
  return (
    <div className="shell shell-wide">
      <main className="main">
        <header className="tech-head">
          <div className="drop-kicker">{tech.placeholder ? "Sample profile" : "AllTen partner tech"}</div>
          <h1 className="h1">{tech.name}</h1>
          <div className="muted">{tech.studio} · {tech.city}</div>
          <p className="why">{tech.bio}</p>
        </header>
        <h2 className="h2">Looks {tech.name.split(" ")[0]} can do exactly</h2>
        <div className="tech-grid">
          {looks.map((l) => (
            <article key={l.id} className="card">
              <a href={`/looks/${l.id}`} aria-label={l.name}>
                <PhotoSlot photo={photoFor(l, skinTone)} ai={wmLabel(l.photoSource)} pos={l.photoPos} alt={l.photoAlt || l.name} tint={tintFor(l.colorFamily)} dark={isDarkTint(l.colorFamily)} />
              </a>
              <div className="card-body">
                <h3 className="card-title"><a href={`/looks/${l.id}`} style={{ textDecoration: "none" }}>{l.name}</a></h3>
                <div className="facts">{factChips(l).map((f) => <span key={f} className="fact">{f}</span>)}</div>
                <a className="btn btn-primary" href={`/looks/${l.id}/book?tech=${tech.slug}`} style={{ flex: "none" }}>Request this look</a>
              </div>
            </article>
          ))}
        </div>
        {!looks.length ? <p className="muted">No bookable looks yet.</p> : null}
      </main>
      <BottomNav current="" />
    </div>
  );
}
