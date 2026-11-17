import { getLook } from "@/lib/engine";
import { submitOnboarding } from "@/lib/actions";
import { PAIRS } from "@/lib/onboarding";
import { requestUid } from "@/lib/request";
import { getProfile } from "@/lib/store";

export const metadata = { title: "Set up your picks" };
export const dynamic = "force-dynamic";

const TONES = [
  { v: "light", label: "Light", img: "/looks/rose-glazed-chrome__light.jpg" },
  { v: "medium", label: "Medium", img: "/looks/rose-glazed-chrome.jpg" },
  { v: "deep", label: "Deep", img: "/looks/rose-glazed-chrome__deep.jpg" },
];
const SHAPES = ["Almond", "Oval", "Square", "Squoval", "Coffin", "Round"];

function Choice({ name, value, label, checked, sub }: { name: string; value: string; label: string; checked?: boolean; sub?: string }) {
  return (
    <label className="opt">
      <input type="radio" name={name} value={value} defaultChecked={checked} />
      <span>{label}{sub ? <small>{sub}</small> : null}</span>
    </label>
  );
}

/** Onboarding, about 60 seconds. Everything is optional except the hand tone; it can be changed later in Profile. */
export default async function Start() {
  const p = await getProfile(requestUid());
  return (
    <div className="shell">
      <main className="main">
        <a className="back" href="/">← Discover</a>
        <header>
          <div className="wordmark">AllTen</div>
          <h1 className="h1">{p.onboarded ? "Update your picks" : "Let's pick looks for you"}</h1>
          <p className="muted">About a minute. You can change any of this later in Profile.</p>
        </header>

        <form action={submitOnboarding} className="onboard">
          <fieldset>
            <legend>Which hand looks most like yours?</legend>
            <p className="muted">We show every look on a hand like yours.</p>
            <div className="tone-grid">
              {TONES.map((t) => (
                <label key={t.v} className="tone-opt">
                  <input type="radio" name="tone" value={t.v} defaultChecked={p.skinTone === t.v} required />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.img} alt={`${t.label} skin tone hand`} />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Which jewelry looks best on you?</legend>
            <p className="muted">It tells us whether warm or cool shades flatter you.</p>
            <div className="opts">
              <Choice name="metal" value="gold" label="Gold" checked={p.jewelryMetal === "gold"} />
              <Choice name="metal" value="silver" label="Silver" checked={p.jewelryMetal === "silver"} />
              <Choice name="metal" value="mixed" label="Both" checked={p.jewelryMetal === "mixed"} />
            </div>
          </fieldset>

          <fieldset>
            <legend>Pick the one you'd rather wear</legend>
            {PAIRS.map(([a, b], i) => {
              const la = getLook(a), lb = getLook(b);
              if (!la || !lb) return null;
              const chosen = p.likes.find((x) => x === a || x === b);
              return (
                <div className="pair" key={i}>
                  {[la, lb].map((l) => (
                    <label key={l.id} className="pair-opt">
                      <input type="radio" name={`pair${i}`} value={l.id} defaultChecked={chosen === l.id} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.photoBySkinTone?.[p.skinTone] ?? l.photoBySkinTone?.medium ?? ""} alt={l.name} loading="lazy" />
                      <span>{l.name}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </fieldset>

          <fieldset>
            <legend>Usual length</legend>
            <div className="opts">
              {["short", "medium", "long"].map((v) => <Choice key={v} name="length" value={v} label={v[0].toUpperCase() + v.slice(1)} checked={p.length === v} />)}
            </div>
          </fieldset>

          <fieldset>
            <legend>Favorite shape</legend>
            <div className="opts">
              {SHAPES.map((v) => <Choice key={v} name="shape" value={v} label={v} checked={p.shape === v} />)}
            </div>
          </fieldset>

          <fieldset>
            <legend>How adventurous?</legend>
            <div className="opts">
              <Choice name="vibe" value="subtle" label="Keep it subtle" checked={p.vibe === "subtle"} />
              <Choice name="vibe" value="balanced" label="Mostly safe, sometimes new" checked={p.vibe === "balanced"} />
              <Choice name="vibe" value="bold" label="Show me bold" checked={p.vibe === "bold"} />
            </div>
          </fieldset>

          <fieldset>
            <legend>Usual budget per set</legend>
            <div className="opts">
              <Choice name="budget" value="50" label="Under $50" checked={p.budget === 50} />
              <Choice name="budget" value="80" label="Up to $80" checked={p.budget === 80} />
              <Choice name="budget" value="120" label="Up to $120" checked={p.budget === 120} />
              <Choice name="budget" value="any" label="Doesn't matter" checked={p.onboarded && p.budget === null} />
            </div>
          </fieldset>

          <button type="submit" className="btn btn-primary">{p.onboarded ? "Save changes" : "Show my looks"}</button>
          {!p.onboarded ? <a href="/" className="muted" style={{ textAlign: "center" }}>Skip for now</a> : null}
        </form>
      </main>
    </div>
  );
}
