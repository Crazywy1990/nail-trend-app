"use client";

import { useEffect, useRef } from "react";
import { logEvent } from "@/lib/events";
import type { Slot } from "@/lib/types";

/** Logs a landing with its source (share link, QR code, social bio link) once per page view. */
export function TrackLanding({ uid, lookId }: { uid: string; lookId?: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const qs = new URLSearchParams(window.location.search);
    logEvent({
      userId: uid,
      type: "landing",
      lookId,
      path: window.location.pathname,
      ref: qs.get("ref") || (document.referrer ? new URL(document.referrer).hostname : undefined),
      utmSource: qs.get("utm_source") || undefined,
    });
  }, [uid, lookId]);
  return null;
}

/** Logs one impression per pick in a served set, with slot and position for later debiasing. */
export function TrackImpressions({
  uid, setId, picks,
}: { uid: string; setId: string; picks: { lookId: string; slot: Slot; position: number }[] }) {
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (done.current === setId) return;
    done.current = setId;
    picks.forEach((p) => logEvent({ userId: uid, type: "impression", setId, ...p }));
  }, [uid, setId, picks]);
  return null;
}

/** Funnel event: one look_view per detail-page view. */
export function TrackView({ uid, lookId }: { uid: string; lookId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    logEvent({ userId: uid, type: "look_view", lookId });
  }, [uid, lookId]);
  return null;
}

/** Browse history: one post_view per community post page view. */
export function TrackPostView({ uid, postId }: { uid: string; postId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    logEvent({ userId: uid, type: "post_view", postId });
  }, [uid, postId]);
  return null;
}
