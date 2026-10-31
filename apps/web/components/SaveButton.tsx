"use client";

import { useState } from "react";
import { logEvent } from "@/lib/events";
import type { Slot } from "@/lib/types";
import { HeartIcon } from "./Icons";

export function SaveButton(p: { uid: string; lookId: string; setId?: string; slot?: Slot; position?: number }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      type="button"
      className="save-btn"
      aria-pressed={saved}
      aria-label={saved ? "Saved. Tap to remove from saved looks" : "Save look"}
      onClick={() => {
        const next = !saved;
        setSaved(next);
        logEvent({ userId: p.uid, type: next ? "save" : "unsave", lookId: p.lookId, setId: p.setId, slot: p.slot, position: p.position });
      }}
    >
      <HeartIcon size={20} filled={saved} />
    </button>
  );
}
