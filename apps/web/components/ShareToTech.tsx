"use client";

import { useState } from "react";
import { logEvent } from "@/lib/events";

/**
 * Share to my tech: sends the branded share card (photo, name, shade codes, price and time)
 * as an image where the device can share files (Instagram DMs, Messages), otherwise the
 * look's spec link, otherwise copies the link.
 */
export function ShareToTech(p: { uid: string; lookId: string; lookName: string; primary?: boolean; tone?: string }) {
  const [note, setNote] = useState("");
  async function share() {
    const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || window.location.origin;
    const url = `${origin}/looks/${p.lookId}/spec?ref=share_tech&utm_source=share${p.tone && p.tone !== "medium" ? `&tone=${p.tone}` : ""}`;
    const text = `Can you do this set? ${p.lookName}. Shades, shape and time are on the AllTen spec: ${url}`;
    logEvent({ userId: p.uid, type: "share_tap", lookId: p.lookId });
    try {
      if (navigator.share) {
        try {
          const res = await fetch(`/looks/${p.lookId}/card${p.tone ? `?tone=${p.tone}` : ""}`);
          const blob = await res.blob();
          const file = new File([blob], `allten-${p.lookId}.png`, { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: p.lookName, text });
            return;
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
        await navigator.share({ title: `AllTen: ${p.lookName}`, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied. Paste it in a DM to your nail tech.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setNote(`Copy this link: ${url}`);
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
      <button type="button" className={p.primary ? "btn btn-primary" : "btn"} onClick={share}>Share to my tech</button>
      {note ? <div className="note" role="status">{note}</div> : null}
      <a className="muted" style={{ fontSize: 12, textAlign: "center" }} href={`/looks/${p.lookId}/card${p.tone ? `?tone=${p.tone}` : ""}`} target="_blank" rel="noopener">Save the share card</a>
    </div>
  );
}
