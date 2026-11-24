import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { chooseHandle } from "@/lib/socialActions";

export const metadata = { title: "Pick your handle", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Welcome({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const user = await currentUser();
  const next = searchParams.next && searchParams.next.startsWith("/") && !searchParams.next.startsWith("//") ? searchParams.next : "/community";
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const suggestion = user.handle ?? user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 20);
  return (
    <div className="shell">
      <main className="main">
        <header>
          <h1 className="h1">Pick your @handle</h1>
          <p className="muted">It&rsquo;s your page address and how people find and follow you.</p>
        </header>
        <form action={chooseHandle} className="onboard">
          <input type="hidden" name="next" value={next} />
          <label className="field">Handle
            <span className="handle-input"><span aria-hidden="true">@</span>
              <input name="handle" required minLength={3} maxLength={20} pattern="[a-z0-9][a-z0-9._]{1,18}[a-z0-9]" defaultValue={suggestion}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </span>
            <small className="muted">3–20 lowercase letters, numbers, dots or underscores.</small>
          </label>
          <label className="field">Display name
            <input name="nickname" required minLength={2} maxLength={20} defaultValue={user.nickname ?? ""} placeholder="e.g. Mocha Nails" />
          </label>
          {searchParams.error ? <p className="notice" role="alert">{searchParams.error}</p> : null}
          <button className="btn btn-primary">Continue</button>
        </form>
      </main>
    </div>
  );
}
