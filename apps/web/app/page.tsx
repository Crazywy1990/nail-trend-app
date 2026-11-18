import { BottomNav } from "@/components/BottomNav";
import { HeroPhoto } from "@/components/Hero";
import { SearchIcon } from "@/components/Icons";
import { LookCard, LookRow } from "@/components/LookCard";
import { TrackImpressions, TrackLanding } from "@/components/Track";
import { fetchDiscover } from "@/lib/api";
import { currentDrop, getLook } from "@/lib/engine";
import { factChips } from "@/lib/format";
import { requestSeason, requestUid } from "@/lib/request";
import { COPY } from "@/lib/season";
import { getProfile, listSaved } from "@/lib/store";

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
    theme: arr(searchParams.theme),
    occasion: arr(searchParams.occasion),
    finish: arr(searchParams.finish),
    length: arr(searchParams.length),
  };

  const [profile, saved] = await Promise.all([getProfile(uid), listSaved(uid)]);
  const data = await fetchDiscover({ userId: uid, q, ...selected, profile: profile.onboarded ? profile : null, saved });
  const savedSet = new Set(saved);

  // Default view opens on this week's hero look, full-bleed; a search or filter goes straight to results.
  const drop = currentDrop();
  const browsing = !q && !Object.values(selected).some((v) => v.length);
  const hero = browsing ? getLook(drop.hero) : null;
  const cards = hero ? data.cards.filter((p) => p.look.id !== hero.id) : data.cards;
  const also = hero ? data.also.filter((p) => p.look.id !== hero.id) : data.also;
  if (hero && cards.length === 0 && also.length) cards.push(also.shift()!);
  const picks = [...cards, ...also].map((p) => ({ lookId: p.look.id, slot: p.slot, position: p.position }));
  const dropDate = new Date(`${drop.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="shell shell-wide">
      {hero ? (
        <HeroPhoto uid={uid} lookId={hero.id} photos={hero.photoBySkinTone} initial={profile.skinTone}
          alt={hero.photoAlt || hero.name} pos={hero.photoPos} ai={hero.photoSource !== "original"}>
          <div className="hero-kicker">{drop.label} · {dropDate}</div>
          <h1 className="hero-title"><a href={`/looks/${hero.id}`}>{hero.name}</a></h1>
          {!hero.trendIsPlaceholder && hero.trendProof.text ? (
            <p className="hero-proof">{hero.trendProof.text}
              {hero.trendAsOf ? <span className="proof-source">· {hero.trendSource?.split(" · ")[0]}, week of {new Date(`${hero.trendAsOf}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span> : null}
            </p>
          ) : null}
          <div className="hero-facts">{factChips(hero).slice(0, 2).join(" · ")}</div>
          <div className="hero-actions">
            <a className="btn btn-primary" href={`/looks/${hero.id}/book`}>Book this look</a>
            <a className="btn btn-glass" href={`/looks/${hero.id}`}>See the spec</a>
          </div>
        </HeroPhoto>
      ) : null}
      <main className="main">
        {!hero ? <h1 className="sr-only">AllTen: see it, book exactly it</h1> : null}

        {!profile.onboarded ? (
          <a href="/start" className="onboard-banner">
            <strong>Get looks picked for you</strong>
            <span>Your hand tone, style and budget, in about a minute →</span>
          </a>
        ) : searchParams.welcome ? (
          <p className="notice">Done. These are picked for you, shown on a hand like yours.</p>
        ) : null}

        <form className="need" method="get" action="/" role="search">
          <label htmlFor="need" className="label">Describe it</label>
          <div className="need-row">
            <input id="need" name="q" type="text" defaultValue={q} placeholder={copy.placeholder} autoComplete="off" />
            {(["theme", "occasion", "finish", "length"] as const).flatMap((g) =>
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
            {browsing ? <div className="drop-kicker">{drop.label} · {dropDate}</div> : null}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 className="h2" id="picked">{browsing ? "Picked for you from this drop" : "Picked for you"}</h2>
              <span className="muted">{cards.length + also.length} looks</span>
            </div>
            <div className="muted">{data.summary}</div>
            {data.understood?.length ? (
              <div className="understood">
                <span className="muted">Showing:</span>
                {data.understood.map((u) => <span key={u} className="tag">{u}</span>)}
                <a href="/" className="clear">Clear</a>
              </div>
            ) : null}
          </div>

          <div className="cards">
            {cards.map((p, i) => (
              <LookCard key={p.look.id} pick={p} uid={uid} setId={data.setId} priority={i === 0} saved={savedSet.has(p.look.id)} />
            ))}
          </div>

          {also.length ? (
            <div className="rows">
              <h2 className="h2" style={{ fontSize: 18 }}>Also in this set</h2>
              <div className="rows-list">
                {also.map((p) => <LookRow key={p.look.id} pick={p} />)}
              </div>
            </div>
          ) : null}
        </section>
      </main>
      <BottomNav current="/" />
      <TrackLanding uid={uid} />
      <TrackImpressions uid={uid} setId={data.setId} picks={picks} />
    </div>
  );
}
