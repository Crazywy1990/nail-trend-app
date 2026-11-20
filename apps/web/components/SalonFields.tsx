"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Salon = { name: string; bookingUrl?: string; instagram?: string; phone?: string; address?: string; placeId?: string; mapsUrl?: string } | null;
type Suggestion = { placeId: string; name: string; secondary: string };

const newSession = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));

/**
 * Salon fields with Google Maps–style search: type a few letters, nearby nail and beauty salons
 * appear in a dropdown; picking one fills the address, phone and website. Everything stays editable,
 * and without a Places key (or if search fails) it's a plain text field.
 */
export function SalonFields({ salon }: { salon: Salon }) {
  const [name, setName] = useState(salon?.name ?? "");
  const [bookingUrl, setBookingUrl] = useState(salon?.bookingUrl ?? "");
  const [phone, setPhone] = useState(salon?.phone ?? "");
  const [picked, setPicked] = useState<{ placeId?: string; address?: string; mapsUrl?: string }>({
    placeId: salon?.placeId, address: salon?.address, mapsUrl: salon?.mapsUrl,
  });
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [enabled, setEnabled] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locNote, setLocNote] = useState("");
  const session = useRef(newSession());
  const typed = useRef(false);
  const listId = useMemo(() => `salon-list-${Math.random().toString(36).slice(2, 8)}`, []);

  useEffect(() => {
    if (!enabled || !typed.current) return;
    const q = name.trim();
    if (q.length < 2) { setItems([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ q, session: session.current, ...(coords ? { lat: String(coords.lat), lng: String(coords.lng) } : {}) });
        const res = await fetch(`/api/v1/places/autocomplete?${qs}`, { signal: ctl.signal });
        const body = await res.json();
        if (body.configured === false) { setEnabled(false); return; }
        setItems(body.suggestions ?? []);
        setOpen(true);
        setActive(-1);
      } catch { /* typing continues to work as plain text */ }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [name, coords, enabled]);

  async function choose(s: Suggestion) {
    setOpen(false);
    setName(s.name);
    setPicked({ placeId: s.placeId, address: s.secondary });
    typed.current = false;
    try {
      const res = await fetch(`/api/v1/places/details?${new URLSearchParams({ id: s.placeId, session: session.current })}`);
      if (res.ok) {
        const d = await res.json();
        setName(d.name || s.name);
        setPicked({ placeId: d.placeId, address: d.address ?? s.secondary, mapsUrl: d.mapsUrl ?? undefined });
        if (d.phone) setPhone(d.phone);
        if (d.website) setBookingUrl(d.website);
      }
    } finally {
      session.current = newSession(); // a pick closes the billing session
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setLocNote("Location isn't available in this browser."); return; }
    setLocNote("Finding salons near you…");
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocNote("Showing salons near you."); },
      () => setLocNote("Couldn't get your location; showing salons near your area instead."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  }

  return (
    <>
      <div className="field salon-search">
        <label htmlFor="salon-name">Salon name</label>
        <input
          id="salon-name" name="name" value={name} maxLength={80} autoComplete="off"
          placeholder={enabled ? "Start typing, e.g. Lux Beauty" : "e.g. Polished Studio"}
          role="combobox" aria-expanded={open && items.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => { typed.current = true; setName(e.target.value); setPicked({}); }}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(items[active]); }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {open && items.length ? (
          <ul className="salon-list" id={listId} role="listbox">
            {items.map((s, i) => (
              <li key={s.placeId} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                className={i === active ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); choose(s); }}>
                <strong>{s.name}</strong>
                <span>{s.secondary}</span>
              </li>
            ))}
            <li className="salon-attrib" aria-hidden="true">Results from Google</li>
          </ul>
        ) : null}
        {enabled ? (
          <button type="button" className="link-btn" onClick={useMyLocation}>Use my location for nearby salons</button>
        ) : null}
        {locNote ? <small role="status">{locNote}</small> : null}
        {picked.address ? (
          <small className="salon-picked">
            📍 {picked.address}{picked.mapsUrl ? <> · <a href={picked.mapsUrl} target="_blank" rel="noopener noreferrer">Map</a></> : null}
          </small>
        ) : null}
      </div>
      <input type="hidden" name="placeId" value={picked.placeId ?? ""} />
      <input type="hidden" name="address" value={picked.address ?? ""} />
      <input type="hidden" name="mapsUrl" value={picked.mapsUrl ?? ""} />
      <label className="field">Online booking link or website <small>optional</small>
        <input name="bookingUrl" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} placeholder="vagaro.com/…, square.site/…, etc." inputMode="url" />
      </label>
      <label className="field">Instagram <small>optional</small><input name="instagram" defaultValue={salon?.instagram} placeholder="@yoursalon" /></label>
      <label className="field">Phone for texts <small>optional</small>
        <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(425) 555-0123" inputMode="tel" />
      </label>
    </>
  );
}
