"use client";

import { useState, type ReactNode } from "react";
import { BookmarkIcon, FlagIcon, HeartIcon, ThumbDownIcon, XIcon } from "./Icons";

type Kind = "like" | "save" | "report" | "dislike" | "hide";
async function react(postId: string, kind: Kind, on: boolean) {
  const res = await fetch("/api/v1/community/react", {
    method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
    body: JSON.stringify({ postId, kind, on }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as { likes: number; saves: number };
}

type Vote = "like" | "dislike" | null;

/** Heart (public count) and thumbs-down (private, only tunes her picks). Picking one clears the other. */
export function LikeDislike({ postId, liked, disliked, count, compact }: { postId: string; liked: boolean; disliked: boolean; count: number; compact?: boolean }) {
  const [vote, setVote] = useState<Vote>(liked ? "like" : disliked ? "dislike" : null);
  const [n, setN] = useState(count);
  const set = (next: Vote) => {
    const prev = vote, prevN = n;
    const kind: Kind = (next ?? prev) as Kind;
    setVote(next);
    setN((x) => x + (next === "like" ? 1 : 0) - (prev === "like" ? 1 : 0));
    react(postId, kind, next !== null).then((c) => setN(c.likes)).catch(() => { setVote(prev); setN(prevN); });
  };
  const cls = compact ? "post-react post-react-sm" : "post-react";
  return (
    <span className="post-votes">
      <button type="button" className={cls} aria-pressed={vote === "like"}
        aria-label={`${vote === "like" ? "Liked" : "Like"}, ${n} ${n === 1 ? "like" : "likes"}`}
        onClick={() => set(vote === "like" ? null : "like")}>
        <HeartIcon size={compact ? 18 : 22} filled={vote === "like"} />
        <span>{n}</span>
      </button>
      <button type="button" className={cls} aria-pressed={vote === "dislike"}
        aria-label={vote === "dislike" ? "Disliked. Tap to undo" : "Dislike (only tunes your picks; nobody sees it)"}
        title="Dislike" onClick={() => set(vote === "dislike" ? null : "dislike")}>
        <ThumbDownIcon size={compact ? 17 : 21} filled={vote === "dislike"} />
        {compact ? null : <span>{vote === "dislike" ? "Disliked" : "Dislike"}</span>}
      </button>
    </span>
  );
}

/** Grid tile wrapper with a "Not interested" ✕: hides the set from her feeds, with Undo. */
export function HideableTile({ postId, children }: { postId: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const toggle = (on: boolean) => { setHidden(on); react(postId, "hide", on).catch(() => setHidden(!on)); };
  if (hidden) {
    return (
      <div className="post-tile post-hidden" role="status">
        <span>Hidden. You&rsquo;ll see fewer sets like this.</span>
        <button type="button" className="link-btn" onClick={() => toggle(false)}>Undo</button>
      </div>
    );
  }
  return (
    <div className="post-tile-wrap">
      {children}
      <button type="button" className="post-hide" aria-label="Not interested" title="Not interested" onClick={() => toggle(true)}>
        <XIcon size={16} />
      </button>
    </div>
  );
}

/** Post page: "Not interested" link with Undo. */
export function NotInterestedButton({ postId, hidden }: { postId: string; hidden: boolean }) {
  const [on, setOn] = useState(hidden);
  const toggle = (next: boolean) => { setOn(next); react(postId, "hide", next).catch(() => setOn(!next)); };
  return on ? (
    <span className="report-ask" role="status">
      <span className="muted">Got it. We&rsquo;ll show you fewer sets like this.</span>
      <button type="button" className="link-btn" onClick={() => toggle(false)}>Undo</button>
    </span>
  ) : (
    <button type="button" className="link-btn" onClick={() => toggle(true)}><XIcon size={16} /> Not interested</button>
  );
}

export function SavePostButton({ postId, saved, compact }: { postId: string; saved: boolean; compact?: boolean }) {
  const [on, setOn] = useState(saved);
  return (
    <button type="button" className={compact ? "post-react post-react-sm" : "post-react"} aria-pressed={on}
      aria-label={on ? "Saved. Tap to remove from saved" : "Save to your saved looks"}
      onClick={() => {
        const next = !on;
        setOn(next);
        react(postId, "save", next).catch(() => setOn(!next));
      }}>
      <BookmarkIcon size={compact ? 18 : 22} filled={on} />
      {compact ? null : <span>{on ? "Saved" : "Save"}</span>}
    </button>
  );
}

export function ReportButton({ postId }: { postId: string }) {
  const [state, setState] = useState<"idle" | "ask" | "done">("idle");
  if (state === "done") return <p className="muted" role="status">Thanks. We'll take a look.</p>;
  if (state === "ask") {
    return (
      <div className="report-ask" role="group" aria-label="Report this post">
        <span className="muted">Report this post as not their own, unsafe or not nails?</span>
        <button type="button" className="btn btn-sm" onClick={() => react(postId, "report", true).finally(() => setState("done"))}>Report</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setState("idle")}>Cancel</button>
      </div>
    );
  }
  return (
    <button type="button" className="link-btn" onClick={() => setState("ask")}><FlagIcon size={16} /> Report</button>
  );
}

export function DeletePostButton({ postId }: { postId: string }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ask) return <button type="button" className="link-btn" onClick={() => setAsk(true)}>Delete my post</button>;
  return (
    <div className="report-ask" role="group" aria-label="Delete post">
      <span className="muted">Delete this post and its photo? This can't be undone.</span>
      <button type="button" className="btn btn-sm" disabled={busy} onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/v1/community/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: postId }) });
        if (res.ok) window.location.href = "/community?deleted=1"; else setBusy(false);
      }}>Delete</button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsk(false)}>Keep it</button>
    </div>
  );
}
