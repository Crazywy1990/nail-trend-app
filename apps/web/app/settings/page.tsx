import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/Icons";
import { currentUser } from "@/lib/auth";
import { logOut, saveAccount } from "@/lib/socialActions";
import { ProfilePhotos } from "@/components/ProfilePhotos";
import { MAX_STYLES, PROFILE_STYLES } from "@/lib/profileStyles";

export const metadata = { title: "Edit profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: { error?: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/settings");
  if (!user.handle) redirect("/welcome?next=/settings");
  return (
    <div className="shell">
      <main className="main">
        <a className="back" href={`/u/${user.handle}`}><ArrowLeft size={18} /> My page</a>
        <h1 className="h1">Edit profile</h1>
        <ProfilePhotos name={user.nickname || user.handle} avatarUrl={user.avatarUrl} coverUrl={user.coverUrl} />
        <form action={saveAccount} className="onboard">
          <p className="muted" style={{ margin: 0 }}>@{user.handle} · {user.email} (private)</p>
          <label className="field">Display name
            <input name="nickname" required minLength={2} maxLength={20} defaultValue={user.nickname ?? ""} />
          </label>
          <label className="field">Bio <small>optional</small>
            <textarea name="bio" rows={3} maxLength={160} defaultValue={user.bio ?? ""} placeholder="Short almond forever. Seattle." />
          </label>
          <label className="field">Location <small>optional</small>
            <input name="location" maxLength={40} defaultValue={user.location ?? ""} placeholder="e.g. Bellevue, WA" autoComplete="address-level2" />
            <small className="muted">Shown on your page. A city or area is enough.</small>
          </label>
          <fieldset className="style-pick">
            <legend>My styles <small className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· pick up to {MAX_STYLES}</small></legend>
            {PROFILE_STYLES.map((t) => (
              <label key={t} className="chip style-chip">
                <input type="checkbox" name="styles" value={t} defaultChecked={user.styles.includes(t)} className="sr-only" />
                {t}
              </label>
            ))}
          </fieldset>
          <label className="consent">
            <input type="checkbox" name="showLikes" defaultChecked={user.showLikes} />
            <span>Show the sets I like and save on my page</span>
          </label>
          {searchParams.error ? <p className="notice" role="alert">{searchParams.error}</p> : null}
          <button className="btn btn-primary">Save</button>
        </form>
        <form action={logOut}><button className="link-btn">Sign out</button></form>
      </main>
    </div>
  );
}
