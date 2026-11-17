import { BottomNav } from "@/components/BottomNav";
import { saveSalon } from "@/lib/actions";
import { requestUid } from "@/lib/request";
import { getProfile } from "@/lib/store";

export const metadata = { title: "My salon" };
export const dynamic = "force-dynamic";

export default async function Salons({ searchParams }: { searchParams: { saved?: string } }) {
  const p = await getProfile(requestUid());
  const s = p.salon;
  return (
    <div className="shell">
      <main className="main">
        <header>
          <h1 className="h1">My salon</h1>
          <p className="muted">Add the salon you usually go to. "Book this look" then sends your tech the exact spec, through their booking page, Instagram or text.</p>
        </header>
        {searchParams.saved ? <p className="notice">{s ? `Saved ${s.name}.` : "Salon removed."}</p> : null}
        <form action={saveSalon} className="onboard">
          <label className="field">Salon name<input name="name" defaultValue={s?.name} placeholder="e.g. Polished Studio" maxLength={80} /></label>
          <label className="field">Online booking link <small>optional</small><input name="bookingUrl" defaultValue={s?.bookingUrl} placeholder="vagaro.com/…, square.site/…, etc." inputMode="url" /></label>
          <label className="field">Instagram <small>optional</small><input name="instagram" defaultValue={s?.instagram} placeholder="@yoursalon" /></label>
          <label className="field">Phone for texts <small>optional</small><input name="phone" defaultValue={s?.phone} placeholder="(425) 555-0123" inputMode="tel" /></label>
          <button type="submit" className="btn btn-primary">{s ? "Save changes" : "Save my salon"}</button>
          <p className="muted" style={{ fontSize: 12 }}>Leave the name empty and save to remove it. Finding salons near you comes later.</p>
        </form>
      </main>
      <BottomNav current="/salons" />
    </div>
  );
}
