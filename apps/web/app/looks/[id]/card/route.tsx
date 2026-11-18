import { ImageResponse } from "next/og";
import { getLook } from "@/lib/engine";
import { factChips, photoFor } from "@/lib/format";

/**
 * Branded share card (1080×1350, Instagram portrait): look photo with the AllTen mark baked in,
 * name, shades with codes, price and time. Shared as an image file by "Share to my tech" and
 * used as the look page's preview image.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const l = getLook(params.id);
  if (!l) return new Response("Not found", { status: 404 });
  const tone = new URL(req.url).searchParams.get("tone") || "medium";
  const photo = photoFor(l, ["light", "medium", "deep"].includes(tone) ? tone : "medium");
  const src = photo ? new URL(photo, req.url).toString() : null;
  const shades = l.shades.slice(0, 3).map((s) => ({
    name: s.brand ? `${s.brand} ${s.name}` : s.name,
    code: s.verified && s.code ? s.code : null,
  }));
  const [price, time] = factChips(l);

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, display: "flex", flexDirection: "column", background: "#f7f0ea", color: "#3a1f17", fontFamily: "sans-serif" }}>
        <div style={{ position: "relative", width: 1080, height: 810, display: "flex", background: "#2a1712" }}>
          {src ? <img src={src} width={1080} height={810} style={{ objectFit: "cover" }} alt="" /> : null}
          <div style={{ position: "absolute", right: 40, bottom: 36, display: "flex", flexDirection: "column", alignItems: "flex-end", color: "rgba(255,255,255,0.85)", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 44, fontWeight: 800 }}>AllTen</div>
            {l.photoSource !== "original" ? <div style={{ fontSize: 18 }}>AI-generated image</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "40px 56px", gap: 18, flexGrow: 1 }}>
          <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{l.name}</div>
          <div style={{ display: "flex", gap: 14, fontSize: 30, fontWeight: 700 }}>
            <div style={{ display: "flex", padding: "6px 18px", borderRadius: 30, background: "#ead8cc" }}>{price}</div>
            <div style={{ display: "flex", padding: "6px 18px", borderRadius: 30, background: "#ead8cc" }}>{time}</div>
            <div style={{ display: "flex", padding: "6px 18px", color: "#7a6258", fontWeight: 600 }}>{l.shape} · {l.length}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 28 }}>
            {shades.map((s) => (
              <div key={s.name} style={{ display: "flex", gap: 12 }}>
                <span style={{ fontWeight: s.code ? 700 : 500 }}>{s.name}</span>
                {s.code ? <span style={{ fontFamily: "monospace", background: "#ead8cc", padding: "0 10px", borderRadius: 8 }}>{s.code}</span> : null}
              </div>
            ))}
          </div>
          <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: 46, fontWeight: 800, color: "#a8341f" }}>AllTen</div>
            <div style={{ fontSize: 24, color: "#7a6258" }}>See it. Book exactly it.</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
