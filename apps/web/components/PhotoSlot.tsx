import { CameraIcon } from "./Icons";

/** 4:3 look photo. With no asset yet, a soft tile in the look's color says the photo is coming. */
export function PhotoSlot({
  photo, pos, alt, tint, dark, children, priority,
}: {
  photo: string | null;
  pos?: string;
  alt: string;
  tint?: string;
  dark?: boolean;
  children?: React.ReactNode;
  priority?: boolean;
}) {
  return (
    <div className="photo" style={!photo && tint ? { background: tint, color: dark ? "#fff" : undefined } : undefined}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={alt} style={{ objectPosition: pos || "center" }} loading={priority ? "eager" : "lazy"} />
      ) : (
        <>
          <CameraIcon size={30} />
          <div className="photo-slot-title">Photo coming soon</div>
        </>
      )}
      {children}
    </div>
  );
}
