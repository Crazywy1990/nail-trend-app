import type { Look } from "@/lib/types";

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Trend evidence with its source and week. Placeholder or stale stats are not shown at all. */
export function ProofStrip({ look }: { look: Pick<Look, "trendProof" | "trendIsPlaceholder" | "trendSource" | "trendAsOf"> }) {
  if (look.trendIsPlaceholder !== false || !look.trendProof.text) return null;
  const platform = look.trendSource?.split(" · ")[0];
  return (
    <div className="proof">
      <span>{look.trendProof.text}</span>
      {look.trendAsOf ? <span className="proof-source">{platform ? `${platform} · ` : ""}week of {fmt(look.trendAsOf)}</span> : null}
    </div>
  );
}
