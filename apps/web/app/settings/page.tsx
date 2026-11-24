import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/Icons";
import { currentUser } from "@/lib/auth";
import { logOut, saveAccount } from "@/lib/socialActions";

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
        <form action={saveAccount} className="onboard">
          <p className="muted" style={{ margin: 0 }}>@{user.handle} · {user.email} (private)</p>
          <label className="field">Display name
            <input name="nickname" required minLength={2} maxLength={20} defaultValue={user.nickname ?? ""} />
          </label>
          <label className="field">Bio <small>optional</small>
            <textarea name="bio" rows={3} maxLength={160} defaultValue={user.bio ?? ""} placeholder="Short almond forever. Seattle." />
          </label>
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
