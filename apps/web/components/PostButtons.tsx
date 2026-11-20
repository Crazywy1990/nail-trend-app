"use client";

import { useState } from "react";
import { BookmarkIcon, FlagIcon, HeartIcon } from "./Icons";

type Kind = "like" | "save" | "report";
async function react(postId: string, kind: Kind, on: boolean) {
  const res = await fetch("/api/v1/community/react", {
    method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
    body: JSON.stringify({ postId, kind, on }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as { likes: number; saves: number };
}

/** Heart with a count. Used on tiles and on the post page. */
export function LikeButton({ postId, liked, count, compact }: { postId: string; liked: boolean; count: number; compact?: boolean }) {
  const [on, setOn] = useState(liked);
  const [n, setN] = useState(count);
  return (
    <button type="button" className={compact ? "post-react post-react-sm" : "post-react"} aria-pressed={on}
      aria-label={`${on ? "Liked" : "Like"}, ${n} ${n === 1 ? "like" : "likes"}${on ? ". Tap to unlike" : ""}`}
      onClick={() => {
        const next = !on;
        setOn(next); setN((x) => x + (next ? 1 : -1));
        react(postId, "like", next).then((c) => setN(c.likes)).catch(() => { setOn(!next); setN((x) => x + (next ? -1 : 1)); });
      }}>
      <HeartIcon size={compact ? 18 : 22} filled={on} />
      <span>{n}</span>
    </button>
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
