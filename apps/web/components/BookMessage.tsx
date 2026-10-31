"use client";

import { useState } from "react";
import { logEvent } from "@/lib/events";

export function BookMessage({ uid, lookId, draft }: { uid: string; lookId: string; draft: string }) {
  const [text, setText] = useState(draft);
  const [note, setNote] = useState("");

  async function copy() {
    logEvent({ userId: uid, type: "book_click", lookId, ref: "copy_message" });
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied. Paste it into a text or DM to your salon.");
    } catch {
      setNote("Select the message above and copy it.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label htmlFor="msg" className="label">Your message</label>
      <textarea id="msg" className="message" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="actions-row">
        <button type="button" className="btn btn-primary" onClick={copy}>Copy message</button>
        <a
          className="btn"
          href={`sms:?&body=${encodeURIComponent(text)}`}
          onClick={() => logEvent({ userId: uid, type: "book_click", lookId, ref: "sms" })}
        >
          Open Messages
        </a>
      </div>
      <div className="note" role="status" aria-live="polite">{note}</div>
    </div>
  );
}
