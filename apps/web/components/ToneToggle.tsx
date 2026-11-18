"use client";

import { useState } from "react";
import { logEvent } from "@/lib/events";
import { PhotoSlot } from "./PhotoSlot";

type Tone = "light" | "medium" | "deep";
const LABEL: Record<Tone, string> = { light: "Light", medium: "Medium", deep: "Deep" };

/**
 * Look photo with a Light / Medium / Deep switch. Starts on her profile tone; the switch only
 * appears when the look has at least two tone variants.
 */
export function TonePhoto(p: {
  uid: string; lookId: string; photos: Partial<Record<Tone, string | null>>; initial: string;
  alt: string; pos?: string; ai?: boolean | string; tint?: string; dark?: boolean; priority?: boolean;
}) {
  const tones = (["light", "medium", "deep"] as Tone[]).filter((t) => p.photos[t]);
  const start = (tones.includes(p.initial as Tone) ? p.initial : tones.includes("medium") ? "medium" : tones[0]) as Tone | undefined;
  const [tone, setTone] = useState<Tone | undefined>(start);
  return (
    <div className="tone-photo">
      <PhotoSlot photo={tone ? p.photos[tone] ?? null : null} pos={p.pos} alt={p.alt} tint={p.tint} dark={p.dark} priority={p.priority} ai={p.ai} />
      {tones.length > 1 ? (
        <div className="tone-switch" role="radiogroup" aria-label="Show on skin tone">
          {tones.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tone === t} className={tone === t ? "on" : ""}
              onClick={() => { setTone(t); logEvent({ userId: p.uid, type: "tone_switch", lookId: p.lookId, tone: t }); }}>
              {LABEL[t]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
