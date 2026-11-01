"use client";

import Link from "next/link";
import { useState } from "react";
import { logEvent } from "@/lib/events";
import type { Slot } from "@/lib/types";

export function CardActions(p: {
  uid: string; lookId: string; lookName: string; setId: string; slot: Slot; position: number;
}) {
  const [note, setNote] = useState("");
  const isStretch = p.slot === "stretch";
  const base = { userId: p.uid, lookId: p.lookId, setId: p.setId, slot: p.slot, position: p.position };

  async function share() {
    const url = `${window.location.origin}/looks/${p.lookId}/spec?ref=share_tech&utm_source=share`;
    logEvent({ ...base, type: "share_click" });
    try {
      if (navigator.share) {
        await navigator.share({ title: "AllTen — shades for your tech", text: `Can you do this set? ${p.lookName} (spec sheet from AllTen)`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied. Send it to your nail tech.");
    } catch {
      setNote(`Copy this link: ${url}`);
    }
  }

  return (
    <div className="actions">
      <Link
        className="btn btn-primary"
        href={`/looks/${p.lookId}/book?set=${p.setId}`}
        onClick={() => logEvent({ ...base, type: "book_click" })}
      >
        Book this look
      </Link>
      <div className="actions-row">
        <button type="button" className="btn" onClick={share}>Share to my tech</button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            logEvent({ ...base, type: isStretch ? "too_bold" : "reject" });
            setNote(isStretch ? "Noted. We'll keep stretch picks a little closer to your style." : "Got it. Fewer looks like this.");
          }}
        >
          {isStretch ? "Too bold" : "Not for me"}
        </button>
      </div>
      <div className="note" role="status" aria-live="polite">{note}</div>
    </div>
  );
}
