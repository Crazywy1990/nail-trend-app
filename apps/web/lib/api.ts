import type { DiscoverResponse, Look } from "./types";

const API_URL = process.env.API_URL || "http://127.0.0.1:8000";

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
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
  const qs = new URLSearchParams({ userId: p.userId });
  if (p.q) qs.set("q", p.q);
  (p.occasion || []).forEach((v) => qs.append("occasion", v));
  (p.finish || []).forEach((v) => qs.append("finish", v));
  (p.length || []).forEach((v) => qs.append("length", v));
  const data = await get<DiscoverResponse>(`/v1/discover?${qs}`);
  if (!data) throw new Error("Discover returned no data");
  return data;
}

export function fetchLook(id: string): Promise<Look | null> {
  return get<Look>(`/v1/looks/${encodeURIComponent(id)}`);
}

export function fetchLooks(): Promise<Look[] | null> {
  return get<Look[]>(`/v1/looks`);
}
