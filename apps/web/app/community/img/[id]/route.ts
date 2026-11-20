import { readImage } from "@/lib/store/community";

/** Serves community photos kept in Postgres (when there's no Blob store). Photos never change, so cache hard. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!/^[a-z0-9]{6,24}$/.test(params.id)) return new Response("Not found", { status: 404 });
  const img = await readImage(params.id);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: { "Content-Type": img.type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
