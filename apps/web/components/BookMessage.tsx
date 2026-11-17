"use client";

import { useState } from "react";
import { logEvent } from "@/lib/events";

type Salon = { name: string; bookingUrl?: string; instagram?: string; phone?: string } | null;

export function BookMessage({ uid, lookId, draft, salon }: { uid: string; lookId: string; draft: string; salon?: Salon }) {
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
          href={`sms:${salon?.phone ? salon.phone.replace(/[^0-9+]/g, "") : ""}?&body=${encodeURIComponent(text)}`}
          onClick={() => logEvent({ userId: uid, type: "book_click", lookId, ref: "sms" })}
        >
          {salon?.phone ? `Text ${salon.name}` : "Open Messages"}
        </a>
      </div>
      {salon?.bookingUrl || salon?.instagram ? (
        <div className="actions-row">
          {salon.bookingUrl ? (
            <a className="btn" href={salon.bookingUrl} target="_blank" rel="noopener noreferrer"
               onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); logEvent({ userId: uid, type: "book_click", lookId, ref: "salon_booking" }); }}>
              Copy &amp; open {salon.name} booking
            </a>
          ) : null}
          {salon.instagram ? (
            <a className="btn" href={`https://ig.me/m/${encodeURIComponent(salon.instagram)}`} target="_blank" rel="noopener noreferrer"
               onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); logEvent({ userId: uid, type: "book_click", lookId, ref: "salon_instagram" }); }}>
              Copy &amp; DM @{salon.instagram}
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="note" role="status" aria-live="polite">{note}</div>
    </div>
  );
}
