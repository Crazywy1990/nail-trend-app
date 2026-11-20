/**
 * Google Places API (New), called only from the server so the key never reaches the browser.
 * Without GOOGLE_PLACES_API_KEY the salon field is plain manual entry.
 * Pricing (2026): Google gives free monthly usage per SKU; a typed search that ends in a pick
 * is one Autocomplete session closed by one Place Details call.
 */
const KEY = process.env.GOOGLE_PLACES_API_KEY || "";
export const placesConfigured = () => !!KEY;

export type SalonSuggestion = { placeId: string; name: string; secondary: string };
export type SalonDetails = {
  placeId: string; name: string; address: string | null; phone: string | null;
  website: string | null; mapsUrl: string | null;
};

const DEFAULT_CENTER = { latitude: 47.6101, longitude: -122.2015 }; // Bellevue, WA

export async function autocomplete(input: string, session: string, center?: { latitude: number; longitude: number } | null): Promise<SalonSuggestion[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY },
    body: JSON.stringify({
      input,
      sessionToken: session,
      includedPrimaryTypes: ["nail_salon", "beauty_salon", "spa"],
      includedRegionCodes: ["us"],
      locationBias: { circle: { center: center ?? DEFAULT_CENTER, radius: 30000 } },
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Places autocomplete ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { suggestions?: { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } }; text?: { text: string } } }[] };
  return (body.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 6)
    .map((p) => ({
      placeId: p.placeId,
      name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export async function details(placeId: string, session: string): Promise<SalonDetails> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(session)}`, {
    headers: {
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,googleMapsUri",
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Places details ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const p = (await res.json()) as { id: string; displayName?: { text: string }; formattedAddress?: string; nationalPhoneNumber?: string; websiteUri?: string; googleMapsUri?: string };
  return {
    placeId: p.id, name: p.displayName?.text ?? "", address: p.formattedAddress ?? null,
    phone: p.nationalPhoneNumber ?? null, website: p.websiteUri ?? null, mapsUrl: p.googleMapsUri ?? null,
  };
}

/** Bias point: the browser's location if she shared it, else Vercel's IP-based location, else Bellevue. */
export function centerFrom(req: Request, lat?: string | null, lng?: string | null) {
  const pick = (a?: string | null, b?: string | null) => {
    const la = Number(a), lo = Number(b);
    return a && b && Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 ? { latitude: la, longitude: lo } : null;
  };
  return pick(lat, lng) ?? pick(req.headers.get("x-vercel-ip-latitude"), req.headers.get("x-vercel-ip-longitude"));
}
