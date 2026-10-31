import type { TrendProof } from "@/lib/types";

/** Trend evidence. A visible "Sample data" tag stays on until the trend pipeline supplies real numbers. */
export function ProofStrip({ proof }: { proof: TrendProof }) {
  if (!proof.text && !proof.isPlaceholder) return null;
  return (
    <div className="proof">
      {proof.isPlaceholder ? <span className="sample-tag">Sample data</span> : null}
      <span>{proof.text || "Trend data coming soon"}</span>
    </div>
  );
}
