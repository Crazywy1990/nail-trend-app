import { BottomNav } from "@/components/BottomNav";
import { clearMyHistory, resetProfile } from "@/lib/actions";
import { getLook } from "@/lib/engine";
import { requestUid } from "@/lib/request";
import { getProfile, hasDatabase, listSaved, recentlyViewed, type HistoryItem } from "@/lib/store";
import { listPosts } from "@/lib/store/community";
import { isDarkTint, tintFor, wmLabel } from "@/lib/format";
import { Watermark } from "@/components/Watermark";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function Profile({ searchParams }: { searchParams: { cleared?: string } }) {
  const uid = requestUid();
  const [p, saved, history] = await Promise.all([getProfile(uid), listSaved(uid), recentlyViewed(uid, 24)]);
  const viewed = await History({ items: history, uid, skinTone: p.skinTone, cleared: !!searchParams.cleared });
  if (!p.onboarded) {
    return (
      <div className="shell">
        <main className="main">
          <h1 className="h1">Your profile</h1>
          <p className="why">Answer a few quick questions and every look is shown on a hand like yours, ranked for your taste, length and budget.</p>
          <a className="btn btn-primary" href="/start" style={{ flex: "none" }}>Set up in a minute</a>
          {viewed}
        </main>
        <BottomNav current="/profile" />
      </div>
    );
  }
  const liked = p.likes.map(getLook).filter(Boolean).map((l) => l!.name);
  const rows: [string, string][] = [
    ["Hand tone", cap(p.skinTone)],
    ["Jewelry", `${p.jewelryMetal === "mixed" ? "Gold and silver" : cap(p.jewelryMetal)} (${p.undertone} shades first)`],
    ["Length", p.length ? cap(p.length) : "Any"],
    ["Shape", p.shape ?? "Any"],
    ["Adventurous", p.vibe === "subtle" ? "Keep it subtle" : p.vibe === "bold" ? "Show me bold" : "Mostly safe, sometimes new"],
    ["Budget", p.budget ? `Up to $${p.budget}` : "Doesn't matter"],
    ["Picked in this-or-that", liked.join(", ") || "—"],
    ["Saved looks", String(saved.length)],
    ["Nickname", p.nickname ? `@${p.nickname}` : "Set when you first share"],
    ["My salon", p.salon?.name ?? "Not set"],
  ];
  return (
    <div className="shell">
      <main className="main">
        <header>
          <h1 className="h1">Your profile</h1>
          <p className="muted">Your picks are ranked from these answers and from the looks you save.</p>
        </header>
        <dl className="profile-list">
          {rows.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <a className="btn btn-primary" href="/start" style={{ flex: "none" }}>Edit answers</a>
        <a className="btn" href="/salons" style={{ flex: "none" }}>{p.salon ? "Edit my salon" : "Add my salon"}</a>
        {viewed}
        <form action={resetProfile}>
          <button className="btn btn-ghost" type="submit" style={{ width: "100%" }}>Start over</button>
        </form>
        <p className="muted" style={{ fontSize: 12 }}>
          {hasDatabase()
            ? "Saved to your AllTen account on this browser."
            : "Saved on this browser only. Clearing cookies resets it."}
        </p>
      </main>
      <BottomNav current="/profile" />
    </div>
  );
}

/** Recently viewed looks and community sets (90 days). Viewing also tunes picks a little. */
async function History({ items, uid, skinTone, cleared }: { items: HistoryItem[]; uid: string; skinTone: string; cleared: boolean }) {
  const postIds = items.filter((h) => h.kind === "post").map((h) => h.ref);
  const posts = new Map(postIds.length ? (await listPosts({ ids: postIds, status: "approved", uid })).map((x) => [x.id, x] as const) : []);
  type Tile = { key: string; href: string; img: string | null; name: string; tint?: string; dark: boolean; ai: string | false; wm: boolean };
  const tiles = items.flatMap((h): Tile[] => {
    if (h.kind === "look") {
      const l = getLook(h.ref);
      if (!l) return [];
      const photo = l.photoBySkinTone?.[skinTone] ?? l.photoBySkinTone?.medium ?? null;
      return [{ key: `l${l.id}`, href: `/looks/${l.id}`, img: photo, name: l.name, tint: tintFor(l.colorFamily), dark: isDarkTint(l.colorFamily), ai: wmLabel(l.photoSource), wm: !!photo }];
    }
    const x = posts.get(h.ref);
    return x ? [{ key: `p${x.id}`, href: `/community/${x.id}`, img: x.imageUrl, name: `@${x.nickname}`, tint: undefined, dark: false, ai: false, wm: false }] : [];
  });
  return (
    <section id="history" aria-labelledby="history-h" className="history">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 className="h2" id="history-h" style={{ fontSize: 18 }}>Recently viewed</h2>
        {tiles.length ? (
          <form action={clearMyHistory}><button type="submit" className="link-btn">Clear</button></form>
        ) : null}
      </div>
      {cleared ? <p className="notice" role="status">History cleared.</p> : null}
      {tiles.length ? (
        <div className="history-row">
          {tiles.map((t) => (
            <a key={t.key} href={t.href} className="history-item">
              <span className="history-thumb" style={t.img ? undefined : { background: t.tint, color: t.dark ? "#fff" : undefined }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.img ? <img src={t.img} alt="" loading="lazy" /> : null}
                {t.wm ? <Watermark ai={t.ai} /> : null}
              </span>
              <span className="history-name">{t.name}</span>
            </a>
          ))}
        </div>
      ) : !cleared ? <p className="muted" style={{ margin: 0 }}>Looks and community sets you open show up here. They also help us pick for you.</p> : null}
    </section>
  );
}
