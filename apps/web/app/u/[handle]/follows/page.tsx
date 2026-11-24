import { notFound } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { FollowButton } from "@/components/FollowButton";
import { ArrowLeft } from "@/components/Icons";
import { sessionUid } from "@/lib/auth";
import { followList, userByHandle } from "@/lib/store/social";

export const dynamic = "force-dynamic";
export const metadata = { title: "Followers", robots: { index: false } };

export default async function Follows({ params, searchParams }: { params: { handle: string }; searchParams: { list?: string } }) {
  const user = await userByHandle(params.handle);
  if (!user?.handle) notFound();
  const which = searchParams.list === "following" ? "following" : "followers";
  const me = await sessionUid();
  const people = await followList(user.uid, which, me);
  const base = `/u/${user.handle}/follows`;
  return (
    <div className="shell">
      <main className="main">
        <a className="back" href={`/u/${user.handle}`}><ArrowLeft size={18} /> @{user.handle}</a>
        <nav className="chips" aria-label="Lists">
          <a className="chip" aria-pressed={which === "followers"} href={`${base}?list=followers`}>Followers</a>
          <a className="chip" aria-pressed={which === "following"} href={`${base}?list=following`}>Following</a>
        </nav>
        {people.length ? (
          <ul className="people">
            {people.map((p) => (
              <li key={p.uid} className="person">
                <a href={`/u/${p.handle}`} className="person-link">
                  <span className="avatar avatar-sm" aria-hidden="true">{p.nickname.slice(0, 1).toUpperCase()}</span>
                  <span><strong>{p.nickname}</strong><br /><span className="muted">@{p.handle}</span></span>
                </a>
                {me && me !== p.uid ? <FollowButton handle={p.handle} following={p.iFollow} signedIn small /> : null}
              </li>
            ))}
          </ul>
        ) : <p className="muted">{which === "followers" ? "No followers yet." : "Not following anyone yet."}</p>}
      </main>
      <BottomNav current="/community" />
    </div>
  );
}
