"use client";

import { useState } from "react";
import type { Slot } from "@/lib/types";
import { HeartIcon } from "./Icons";

export function SaveButton(p: { uid: string; lookId: string; initial?: boolean; setId?: string; slot?: Slot; position?: number }) {
  const [saved, setSaved] = useState(!!p.initial);
  return (
    <button
      type="button"
      className="save-btn"
      aria-pressed={saved}
      aria-label={saved ? "Saved. Tap to remove from saved looks" : "Save look"}
      onClick={() => {
        const next = !saved;
        setSaved(next);
        fetch("/api/v1/saved", {
          method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
          body: JSON.stringify({ lookId: p.lookId, on: next, setId: p.setId, slot: p.slot, position: p.position }),
        }).catch(() => setSaved(!next));
      }}
    >
      <HeartIcon size={20} filled={saved} />
    </button>
  );
}
