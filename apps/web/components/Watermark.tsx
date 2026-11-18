/**
 * The AllTen watermark, rendered as an overlay inside the photo's container so no crop can clip it.
 * One method everywhere (cards, rows, hero, detail, onboarding, tech pages): sized with container
 * query units, same corner, same opacity. The share card bakes the same mark into its image.
 * `corner="top"` is used only where UI covers the bottom-right (the hero's text block).
 */
export function Watermark({ ai = true, corner = "bottom" }: { ai?: boolean | string; corner?: "bottom" | "top" }) {
  return (
    <span className={`wm wm-${corner}`} aria-hidden="true">
      <span className="wm-mark">AllTen</span>
      {ai ? <span className="wm-sub">{typeof ai === "string" ? ai : "AI-generated image"}</span> : null}
    </span>
  );
}
