import type { Look } from "@/lib/types";

/**
 * Shades for the tech. Only codes checked against a retailer or pro listing (`verified`) get the
 * "for your tech" authority styling; the rest are shown plainly as approximate matches.
 */
export function ShadeList({ look }: { look: Pick<Look, "shades" | "shape" | "length"> }) {
  const verified = look.shades.filter((s) => s.verified && s.code);
  const other = look.shades.filter((s) => !(s.verified && s.code));
  const name = (s: Look["shades"][number]) => (s.brand ? `${s.brand} ${s.name}` : s.name);
  return (
    <div className="shades">
      {verified.length ? (
        <div className="spec">
          <div className="label">Shades for your tech</div>
          <ul className="shade-list">
            {verified.map((s) => <li key={s.name}><strong>{name(s)}</strong> <span className="code">{s.code}</span></li>)}
          </ul>
        </div>
      ) : null}
      {other.length ? (
        <div className="shades-approx">
          <div className="muted label-plain">{verified.length ? "Also" : "Shades"} (approximate, no verified code yet)</div>
          <ul className="shade-list plain">{other.map((s) => <li key={s.name}>{name(s)}</li>)}</ul>
        </div>
      ) : null}
      <div className="muted" style={{ fontSize: 13 }}>{look.shape} · {look.length}</div>
    </div>
  );
}
