"use client";

import { useState } from "react";

export function ReportLink({ kind, id }: { kind: "comment" | "review"; id: string }) {
  const [done, setDone] = useState(false);
  return done ? <span className="muted" style={{ fontSize: 12 }}>Reported</span> : (
    <button type="button" className="link-btn link-sm" onClick={() => {
      setDone(true);
      fetch("/api/v1/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) });
    }}>Report</button>
  );
}
