"use client";

import type { EventType, Slot } from "./types";

export type EventPayload = {
  userId: string;
  type: EventType;
  lookId?: string;
  setId?: string;
  slot?: Slot;
  position?: number;
  path?: string;
  ref?: string;
  utmSource?: string;
};

const ENDPOINT = "/api/v1/events";

/** Fire-and-forget; survives page navigation (keepalive / sendBeacon). */
export function logEvent(e: EventPayload): void {
  const body = JSON.stringify(e);
  try {
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
  } catch {
    /* fall through to fetch */
  }
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}
