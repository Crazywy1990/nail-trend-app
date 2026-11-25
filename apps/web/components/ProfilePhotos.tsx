"use client";

import { useRef, useState } from "react";
import { CameraIcon } from "./Icons";

async function shrink(file: File, max: number): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return (await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9))) ?? file;
  } catch { return file; }
}

/** Cover and profile photo pickers on the edit page. Each uploads on its own as soon as she picks a photo. */
export function ProfilePhotos({ name, avatarUrl, coverUrl }: { name: string; avatarUrl: string | null; coverUrl: string | null }) {
  const [avatar, setAvatar] = useState(avatarUrl);
  const [cover, setCover] = useState(coverUrl);
  const [busy, setBusy] = useState<"avatar" | "cover" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const avatarIn = useRef<HTMLInputElement>(null);
  const coverIn = useRef<HTMLInputElement>(null);

  const upload = async (kind: "avatar" | "cover", file: File | undefined) => {
    if (!file) return;
    setBusy(kind); setError(null);
    const form = new FormData();
    form.set("kind", kind);
    form.set("photo", await shrink(file, kind === "avatar" ? 900 : 2000), "photo.jpg");
    const res = await fetch("/api/v1/me/photo", { method: "POST", body: form });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    setBusy(null);
    if (!res.ok || !json.url) { setError(json.error || "Upload failed. Try again."); return; }
    (kind === "avatar" ? setAvatar : setCover)(json.url);
  };
  const remove = async (kind: "avatar" | "cover") => {
    await fetch("/api/v1/me/photo", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
    (kind === "avatar" ? setAvatar : setCover)(null);
  };

  return (
    <div className="photo-edit">
      <div className="cover-edit" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
        <button type="button" className="btn btn-glass btn-sm" onClick={() => coverIn.current?.click()} disabled={busy !== null}>
          <CameraIcon size={16} /> {busy === "cover" ? "Uploading…" : cover ? "Change background" : "Add background"}
        </button>
        {cover ? <button type="button" className="btn btn-glass btn-sm" onClick={() => remove("cover")}>Remove</button> : null}
        <input ref={coverIn} type="file" accept="image/*" className="sr-only" onChange={(e) => upload("cover", e.target.files?.[0])} />
      </div>
      <div className="avatar-edit">
        <button type="button" className="avatar-btn" onClick={() => avatarIn.current?.click()} disabled={busy !== null} aria-label="Change profile photo">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar avatar-lg avatar-img" src={avatar} alt="" />
          ) : <span className="avatar avatar-lg" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
          <span className="avatar-cam"><CameraIcon size={16} /></span>
        </button>
        <div>
          <strong>{busy === "avatar" ? "Uploading…" : "Profile photo"}</strong>
          {avatar ? <><br /><button type="button" className="link-btn link-sm" onClick={() => remove("avatar")}>Remove photo</button></> : <><br /><span className="muted" style={{ fontSize: 13 }}>Tap to add</span></>}
        </div>
        <input ref={avatarIn} type="file" accept="image/*" className="sr-only" onChange={(e) => upload("avatar", e.target.files?.[0])} />
      </div>
      {error ? <p className="notice" role="alert">{error}</p> : null}
    </div>
  );
}
