/** Profile photo, or her initial on the brand color when she hasn't set one. */
export function Avatar({ name, url, size = "md" }: { name: string; url?: string | null; size?: "sm" | "md" | "lg" }) {
  const cls = `avatar${size === "sm" ? " avatar-sm" : size === "lg" ? " avatar-lg" : ""}`;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`${cls} avatar-img`} src={url} alt="" loading="lazy" decoding="async" />
  ) : (
    <span className={cls} aria-hidden="true">{(name || "?").slice(0, 1).toUpperCase()}</span>
  );
}
