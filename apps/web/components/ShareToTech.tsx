"use client";

import { useState } from "react";
import { logEvent } from "@/lib/events";

/** Shares a public spec-sheet link. Every share puts the app in front of a nail tech. */
export function ShareToTech(p: { uid: string; lookId: string; lookName: string; primary?: boolean }) {
  const [note, setNote] = useState("");
  async function share() {
    const url = `${window.location.origin}/looks/${p.lookId}/spec?ref=share_tech&utm_source=share`;
    logEvent({ userId: p.uid, type: "share_click", lookId: p.lookId });
    try {
      if (navigator.share) {
        await navigator.share({ title: p.lookName, text: `Can you do this set? ${p.lookName}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied. Send it to your nail tech.");
    } catch {
      setNote(`Copy this link: ${url}`);
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
      <button type="button" className={p.primary ? "btn btn-primary" : "btn"} onClick={share}>Share to my tech</button>
      {note ? <div className="note" role="status">{note}</div> : null}
    </div>
  );
}
