"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon } from "./Icons";

/** Shrinks big phone photos before upload (faster on cellular, under the server's size limit). Falls back to the original. */
async function shrink(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 3_000_000 && /jpe?g|png|webp/.test(file.type)) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function UploadForm({ handle }: { handle: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <form
      className="onboard upload-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const form = new FormData(e.currentTarget);
        if (!file) { setError("Choose a photo of your nails."); return; }
        setBusy(true);
        try {
          form.set("photo", await shrink(file), "nails.jpg");
          const res = await fetch("/api/v1/community/posts", { method: "POST", body: form });
          const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
          if (!res.ok || !json.id) { setError(json.error || "Something went wrong. Try again."); setBusy(false); return; }
          window.location.href = `/community?posted=${json.id}`;
        } catch {
          setError("Couldn't upload. Check your connection and try again.");
          setBusy(false);
        }
      }}
    >
      <label className={`upload-drop${preview ? " has-photo" : ""}`}>
        <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          setPreview(f ? URL.createObjectURL(f) : null);
        }} />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Your photo" />
        ) : (
          <span className="upload-empty"><CameraIcon size={32} /><strong>Add a photo</strong><span className="muted">Close up, good light, nails in focus</span></span>
        )}
      </label>
      {preview ? <button type="button" className="link-btn" onClick={() => input.current?.click()}>Choose a different photo</button> : null}

      <p className="muted" style={{ margin: 0 }}>Posting as <strong>@{handle}</strong></p>
      <label className="field">Caption <small>optional</small>
        <textarea name="caption" rows={2} maxLength={200} placeholder="Milky pink with gold flakes, done at …" />
      </label>
      <label className="consent">
        <input type="checkbox" name="consent" value="yes" required />
        <span>These are my nails and my photo. I agree to the guidelines below and let AllTen show this post in the app.</span>
      </label>
      {error ? <p className="notice" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Checking your photo…" : "Share"}</button>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>Location data is removed from your photo. You can delete your post any time.</p>
    </form>
  );
}
