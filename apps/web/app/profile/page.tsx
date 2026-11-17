import { BottomNav } from "@/components/BottomNav";
import { resetProfile } from "@/lib/actions";
import { getLook } from "@/lib/engine";
import { requestUid } from "@/lib/request";
import { getProfile, hasDatabase, listSaved } from "@/lib/store";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function Profile() {
  const uid = requestUid();
  const [p, saved] = await Promise.all([getProfile(uid), listSaved(uid)]);
  if (!p.onboarded) {
    return (
      <div className="shell">
        <main className="main">
          <h1 className="h1">Your profile</h1>
          <p className="why">Answer a few quick questions and every look is shown on a hand like yours, ranked for your taste, length and budget.</p>
          <a className="btn btn-primary" href="/start" style={{ flex: "none" }}>Set up in a minute</a>
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
