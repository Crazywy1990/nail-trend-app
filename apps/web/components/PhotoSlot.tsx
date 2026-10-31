import { CameraIcon } from "./Icons";

/** 4:3 look photo. With no asset, renders a clearly marked placeholder slot — never swatch bars. */
export function PhotoSlot({
  photo, pos, alt, brief, children, priority,
}: {
  photo: string | null;
  pos?: string;
  alt: string;
  brief?: string | null;
  children?: React.ReactNode;
  priority?: boolean;
}) {
  return (
    <div className="photo">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={alt} style={{ objectPosition: pos || "center" }} loading={priority ? "eager" : "lazy"} />
      ) : (
        <>
          <CameraIcon size={34} />
          <div className="photo-slot-title">Photo slot · 4:3</div>
          {brief ? <div className="photo-slot-brief">{brief}</div> : null}
        </>
      )}
      {children}
    </div>
  );
}
