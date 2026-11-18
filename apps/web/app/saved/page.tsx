import { wmLabel } from "@/lib/format";
import { BottomNav } from "@/components/BottomNav";
import { getLook } from "@/lib/engine";
import { factChips, isDarkTint, tintFor } from "@/lib/format";
import { requestUid } from "@/lib/request";
import { getProfile, listSaved } from "@/lib/store";
import { SaveButton } from "@/components/SaveButton";
import { Watermark } from "@/components/Watermark";

export const metadata = { title: "Saved" };
export const dynamic = "force-dynamic";

export default async function Saved() {
  const uid = requestUid();
  const [ids, p] = await Promise.all([listSaved(uid), getProfile(uid)]);
  const looks = ids.map(getLook).filter((l): l is NonNullable<typeof l> => !!l);
  return (
    <div className="shell shell-wide">
      <main className="main">
        <header>
          <h1 className="h1">Saved looks</h1>
          <p className="muted">{looks.length ? `${looks.length} saved. Saving also tunes your picks.` : "Tap the heart on any look to keep it here."}</p>
        </header>
        {looks.length ? (
          <div className="rows-list saved-grid">
            {looks.map((l) => {
              const photo = l.photoBySkinTone?.[p.skinTone] ?? l.photoBySkinTone?.medium ?? null;
              return (
                <div key={l.id} className="row saved-row">
                  <a href={`/looks/${l.id}`} className="thumb" style={photo ? undefined : { background: tintFor(l.colorFamily), color: isDarkTint(l.colorFamily) ? "#fff" : undefined }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photo ? <img src={photo} alt={l.photoAlt ?? l.name} loading="lazy" /> : null}
                    {photo ? <Watermark ai={wmLabel(l.photoSource)} /> : null}
                  </a>
                  <div className="row-text">
                    <a href={`/looks/${l.id}`} className="row-name">{l.name}</a>
                    <span className="row-meta">{factChips(l).join(" · ")}</span>
                    <div className="saved-actions">
                      <a className="btn btn-primary btn-sm" href={`/looks/${l.id}/book`}>Book</a>
                      <a className="btn btn-sm" href={`/looks/${l.id}/spec`}>Spec for my tech</a>
                      <SaveButton uid={uid} lookId={l.id} initial />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <a className="btn btn-primary" href="/" style={{ flex: "none" }}>Find looks</a>
        )}
      </main>
      <BottomNav current="/saved" />
    </div>
  );
}
