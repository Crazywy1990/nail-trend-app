"use client";

import { useEffect, useState } from "react";

export function FollowButton({ handle, following, signedIn, small }: { handle: string; following: boolean; signedIn: boolean; small?: boolean }) {
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);
  const cls = `btn ${on ? "" : "btn-primary"} follow-btn${small ? " btn-sm" : ""}`;
  if (!signedIn) {
    return <a className={cls} href={`/login?next=${encodeURIComponent(`/u/${handle}`)}`}>Follow</a>;
  }
  return (
    <button type="button" className={cls} aria-pressed={on} disabled={busy} onClick={async () => {
      const next = !on; setOn(next); setBusy(true);
      const res = await fetch("/api/v1/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, on: next }) });
      if (!res.ok) setOn(!next);
      else window.dispatchEvent(new CustomEvent("allten:follow", { detail: { handle, ...(await res.json()) } }));
      setBusy(false);
    }}>{on ? "Following" : "Follow"}</button>
  );
}

/** Follower count that updates when the follow button on the same page is tapped. */
export function FollowerCount({ handle, initial }: { handle: string; initial: number }) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    const h = (e: Event) => { const d = (e as CustomEvent).detail; if (d.handle === handle) setN(d.followers); };
    window.addEventListener("allten:follow", h);
    return () => window.removeEventListener("allten:follow", h);
  }, [handle]);
  return <>{n}</>;
}
