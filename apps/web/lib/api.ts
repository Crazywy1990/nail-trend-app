import type { DiscoverResponse, Look } from "./types";
import * as engine from "./engine";

/**
 * Data source for the web app.
 * Default: the built-in engine (lib/engine), so the site runs on Vercel alone.
 * Set USE_REMOTE_API=1 (plus API_URL) to call the Python service in services/api instead.
 */
export const USE_REMOTE_API = process.env.USE_REMOTE_API === "1";
export const API_URL = (process.env.API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "").replace(/\/v1$/, "");
const TIMEOUT_MS = 45_000;

export class ApiUnavailable extends Error {}

async function get<T>(path: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    console.error(`[allten] API unreachable at ${API_URL}${path}:`, err);
    throw new ApiUnavailable(`API unreachable at ${API_URL}`);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`[allten] API ${res.status} for ${API_URL}${path}`);
    throw new ApiUnavailable(`API ${res.status} for ${path}`);
  }
  return (await res.json()) as T;
}

export type DiscoverParams = {
  userId: string;
  q?: string;
  occasion?: string[];
  finish?: string[];
  length?: string[];
};

export async function fetchDiscover(p: DiscoverParams): Promise<DiscoverResponse> {
  if (!USE_REMOTE_API) {
    return engine.discover(p.userId, p.q || "", {
      occasion: p.occasion || [], finish: p.finish || [], length: p.length || [],
    });
  }
  const qs = new URLSearchParams({ userId: p.userId });
  if (p.q) qs.set("q", p.q);
  (p.occasion || []).forEach((v) => qs.append("occasion", v));
  (p.finish || []).forEach((v) => qs.append("finish", v));
  (p.length || []).forEach((v) => qs.append("length", v));
  const data = await get<DiscoverResponse>(`/v1/discover?${qs}`);
  if (!data) throw new ApiUnavailable("Discover returned no data");
  return data;
}

export async function fetchLook(id: string): Promise<Look | null> {
  if (!USE_REMOTE_API) return engine.getLook(id);
  return get<Look>(`/v1/looks/${encodeURIComponent(id)}`);
}

export async function fetchLooks(): Promise<Look[] | null> {
  if (!USE_REMOTE_API) return engine.LOOKS;
  return get<Look[]>(`/v1/looks`);
}
