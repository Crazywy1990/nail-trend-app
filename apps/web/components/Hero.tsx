"use client";

import { useState } from "react";
import { logEvent } from "@/lib/events";
import { Watermark } from "./Watermark";

type Tone = "light" | "medium" | "deep";

/**
 * Full-bleed hero photo of this week's hero look, with a skin-tone switch (top-left, only when
 * variants exist). Text and the Book button sit bottom-left, so the watermark goes top-right.
 */
export function HeroPhoto(p: {
  uid: string; lookId: string; photos: Partial<Record<Tone, string | null>>; initial: string;
  alt: string; pos?: string; ai?: boolean; children: React.ReactNode;
}) {
  const tones = (["light", "medium", "deep"] as Tone[]).filter((t) => p.photos[t]);
  const [tone, setTone] = useState<Tone>((tones.includes(p.initial as Tone) ? p.initial : "medium") as Tone);
  const src = p.photos[tone] ?? p.photos.medium ?? "";
  return (
    <section className="hero" aria-label="This week's hero look">
      <div className="hero-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={p.alt} style={{ objectPosition: p.pos || "center" }} fetchPriority="high" />
        <div className="hero-shade" aria-hidden="true" />
        <Watermark ai={p.ai} corner="top" />
        {tones.length > 1 ? (
          <div className="tone-switch hero-tones" role="radiogroup" aria-label="Show on skin tone">
            {tones.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tone === t} className={tone === t ? "on" : ""}
                onClick={() => { setTone(t); logEvent({ userId: p.uid, type: "tone_switch", lookId: p.lookId, tone: t }); }}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="hero-text">{p.children}</div>
      </div>
    </section>
  );
}
