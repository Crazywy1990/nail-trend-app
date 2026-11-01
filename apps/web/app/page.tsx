import { BottomNav } from "@/components/BottomNav";
import { SearchIcon } from "@/components/Icons";
import { LookCard, LookRow } from "@/components/LookCard";
import { TrackImpressions, TrackLanding } from "@/components/Track";
import { fetchDiscover } from "@/lib/api";
import { requestSeason, requestUid } from "@/lib/request";
import { COPY } from "@/lib/season";

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

function toggleHref(sp: SP, group: string, value: string): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "ref" || k === "utm_source") continue;
    arr(v).forEach((x) => qs.append(k, x));
  }
  const current = qs.getAll(group);
  qs.delete(group);
  (current.includes(value) ? current.filter((x) => x !== value) : [...current, value]).forEach((x) => qs.append(group, x));
  const s = qs.toString();
  return s ? `/?${s}` : "/";
}

export default async function Discover({ searchParams }: { searchParams: SP }) {
  const season = requestSeason();
  const uid = requestUid();
  const copy = COPY[season];
  const q = arr(searchParams.q)[0] || "";
  const selected = {
    occasion: arr(searchParams.occasion),
    finish: arr(searchParams.finish),
    length: arr(searchParams.length),
  };

  const data = await fetchDiscover({ userId: uid, q, ...selected });
  const picks = [...data.cards, ...data.also].map((p) => ({ lookId: p.look.id, slot: p.slot, position: p.position }));

  return (
    <div className="shell">
      <main className="main">
        <header>
          <div className="wordmark">AllTen</div>
          <div className="greet">{copy.greet}</div>
          <h1 className="h1">{copy.head}</h1>
        </header>

        <form className="need" method="get" action="/" role="search">
          <label htmlFor="need" className="label">Describe it</label>
          <div className="need-row">
            <input id="need" name="q" type="text" defaultValue={q} placeholder={copy.placeholder} autoComplete="off" />
            {(["occasion", "finish", "length"] as const).flatMap((g) =>
              selected[g].map((v) => <input key={g + v} type="hidden" name={g} value={v} />),
            )}
            <button type="submit" className="icon-btn" aria-label="Find looks"><SearchIcon /></button>
          </div>
        </form>

        <div className="chips" aria-label="Filters">
          {copy.chips.map((c) => {
            const on = selected[c.group].includes(c.value);
            return (
              <a key={c.group + c.value} className="chip" aria-pressed={on} href={toggleHref(searchParams, c.group, c.value)}>
                {c.label}
              </a>
            );
          })}
        </div>

        <section aria-labelledby="picked" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 className="h2" id="picked">Picked for you</h2>
              <span className="muted">{data.cards.length + data.also.length} looks</span>
            </div>
            <div className="muted">{data.summary}</div>
          </div>

          {data.cards.map((p, i) => (
            <LookCard key={p.look.id} pick={p} uid={uid} setId={data.setId} priority={i === 0} />
          ))}

          <div className="rows">
            <h2 className="h2" style={{ fontSize: 18 }}>Also in this set</h2>
            {data.also.map((p) => <LookRow key={p.look.id} pick={p} />)}
          </div>
        </section>
      </main>
      <BottomNav current="/" />
      <TrackLanding uid={uid} />
      <TrackImpressions uid={uid} setId={data.setId} picks={picks} />
    </div>
  );
}
