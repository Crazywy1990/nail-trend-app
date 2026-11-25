import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/Icons";
import { currentUser } from "@/lib/auth";
import { deleteMyAccount } from "@/lib/socialActions";

export const metadata = { title: "Delete account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DeleteAccount({ searchParams }: { searchParams: { error?: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/settings/delete");
  return (
    <div className="shell">
      <main className="main">
        <a className="back" href="/settings"><ArrowLeft size={18} /> Settings</a>
        <h1 className="h1">Delete your account</h1>
        <p className="why">This permanently deletes {user.handle ? <strong>@{user.handle}</strong> : "your account"} and everything in it:</p>
        <ul className="delete-list">
          <li>Your profile, profile photo and background photo</li>
          <li>Every set you shared, with its likes and comments</li>
          <li>Your comments, replies and salon reviews</li>
          <li>Who you follow and who follows you</li>
          <li>Your likes, saves, answers, viewing history and booking requests</li>
        </ul>
        <p className="muted" style={{ margin: 0 }}>It can&rsquo;t be undone. Your handle becomes available to others.</p>
        <form action={deleteMyAccount} className="onboard">
          <label className="field">Type DELETE to confirm
            <input name="confirm" required autoComplete="off" autoCapitalize="characters" placeholder="DELETE" />
          </label>
          {searchParams.error ? <p className="notice" role="alert">{searchParams.error}</p> : null}
          <button className="btn btn-danger">Delete my account</button>
        </form>
        <a className="link-btn" href="/settings">Cancel</a>
      </main>
    </div>
  );
}
