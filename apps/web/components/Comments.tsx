"use client";

import { useState } from "react";
import type { Comment } from "@/lib/store/social";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** Comments with one level of replies. Signed-in users with a handle can comment; others see a sign-in link. */
export function Comments({ postId, initial, canComment, needsHandle, isPostAuthor }: {
  postId: string; initial: Comment[]; canComment: boolean; needsHandle: boolean; isPostAuthor: boolean;
}) {
  const [list, setList] = useState(initial);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const top = list.filter((c) => !c.parentId);
  const replies = (id: string) => list.filter((c) => c.parentId === id);

  const submit = async () => {
    setBusy(true); setError(null);
    const res = await fetch("/api/v1/comments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, body: text, parentId: replyTo?.id }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    setBusy(false);
    if (!res.ok || !json.id) { setError(json.error || "Couldn't post your comment."); return; }
    // Reload to show it with her handle and the right thread position.
    window.location.reload();
  };
  const remove = async (c: Comment) => {
    const res = await fetch("/api/v1/comments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
    if (res.ok) setList((l) => l.filter((x) => x.id !== c.id && x.parentId !== c.id));
  };
  const flag = async (c: Comment) => {
    setReported((s) => new Set(s).add(c.id));
    await fetch("/api/v1/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "comment", id: c.id }) });
  };

  const one = (c: Comment, isReply = false) => (
    <li key={c.id} className={isReply ? "comment comment-reply" : "comment"}>
      <div className="comment-head">
        {c.handle ? <a href={`/u/${c.handle}`} className="comment-who">{c.nickname}</a> : <span className="comment-who">{c.nickname}</span>}
        <span className="muted">{ago(c.createdAt)}</span>
      </div>
      <p className="comment-body">{c.body}</p>
      <div className="comment-actions">
        {canComment ? <button type="button" className="link-btn link-sm" onClick={() => { setReplyTo(c); document.getElementById("comment-box")?.focus(); }}>Reply</button> : null}
        {c.mine || isPostAuthor ? <button type="button" className="link-btn link-sm" onClick={() => remove(c)}>Delete</button> : null}
        {!c.mine ? (reported.has(c.id)
          ? <span className="muted" style={{ fontSize: 12 }}>Reported</span>
          : <button type="button" className="link-btn link-sm" onClick={() => flag(c)}>Report</button>) : null}
      </div>
      {!isReply && replies(c.id).length ? <ul className="comment-list">{replies(c.id).map((r) => one(r, true))}</ul> : null}
    </li>
  );

  return (
    <section className="comments" aria-labelledby="comments-h">
      <h2 className="h2" id="comments-h" style={{ fontSize: 18 }}>Comments {list.length ? <span className="muted">· {list.length}</span> : null}</h2>
      {top.length ? <ul className="comment-list">{top.map((c) => one(c))}</ul> : <p className="muted" style={{ margin: 0 }}>No comments yet. Say something nice!</p>}
      {canComment ? (
        <form className="comment-form" onSubmit={(e) => { e.preventDefault(); if (text.trim()) submit(); }}>
          {replyTo ? (
            <div className="replying">Replying to {replyTo.nickname} <button type="button" className="link-btn link-sm" onClick={() => setReplyTo(null)}>Cancel</button></div>
          ) : null}
          <label htmlFor="comment-box" className="sr-only">Add a comment</label>
          <textarea id="comment-box" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" />
          {error ? <p className="notice" role="alert">{error}</p> : null}
          <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>{busy ? "Posting…" : "Post"}</button>
        </form>
      ) : needsHandle ? (
        <a className="link-btn" href={`/welcome?next=${encodeURIComponent(`/community/${postId}`)}`}>Pick your @handle to comment</a>
      ) : (
        <a className="link-btn" href={`/login?next=${encodeURIComponent(`/community/${postId}`)}`}>Sign in to comment</a>
      )}
    </section>
  );
}
