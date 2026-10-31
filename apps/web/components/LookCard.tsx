import { metaLine, slotLabel, specLine } from "@/lib/format";
import type { Pick } from "@/lib/types";
import { CardActions } from "./CardActions";
import { PhotoSlot } from "./PhotoSlot";
import { ProofStrip } from "./ProofStrip";
import { SaveButton } from "./SaveButton";

export function LookCard({ pick, uid, setId, priority }: { pick: Pick; uid: string; setId: string; priority?: boolean }) {
  const l = pick.look;
  return (
    <article className="card" aria-labelledby={`t-${l.id}`}>
      <PhotoSlot photo={pick.photo} pos={l.photoPos} alt={l.photoAlt || l.name} brief={l.photoBrief} priority={priority}>
        <span className="badge badge-trend">↑ Rising</span>
        <SaveButton uid={uid} lookId={l.id} setId={setId} slot={pick.slot} position={pick.position} />
        {pick.slot === "stretch" ? <span className="badge badge-slot">{slotLabel(pick.slot, l)}</span> : null}
      </PhotoSlot>
      <div className="card-body">
        <ProofStrip proof={l.trendProof} />
        <h3 className="card-title" id={`t-${l.id}`}>
          <a href={`/looks/${l.id}`} style={{ textDecoration: "none" }}>{l.name}</a>
        </h3>
        <div className="muted">{metaLine(l)}</div>
        <p className="why">{pick.why}</p>
        <div className="spec">
          <div className="label">Shades for your tech</div>
          <div className="spec-text">{specLine(l)}</div>
        </div>
        <CardActions uid={uid} lookId={l.id} lookName={l.name} setId={setId} slot={pick.slot} position={pick.position} />
      </div>
    </article>
  );
}

export function LookRow({ pick }: { pick: Pick }) {
  const l = pick.look;
  return (
    <a className="row" href={`/looks/${l.id}`}>
      <div className="thumb">
        {pick.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pick.photo} alt="" style={{ objectPosition: l.photoPos }} />
        ) : (
          <span className="muted" style={{ fontSize: 12 }} aria-hidden="true">4:3</span>
        )}
      </div>
      <div className="row-text">
        <span className="row-slot">{slotLabel(pick.slot, l)}</span>
        <span className="row-name">{l.name}</span>
        <span className="row-meta">{metaLine(l)}</span>
      </div>
    </a>
  );
}
