import { submitBookingRequest } from "@/lib/actions";

/** Booking request for one look (optionally with one tech). Server action, works without JavaScript. */
export function BookingForm({ lookId, tech, error }: { lookId: string; tech?: string | null; error?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={submitBookingRequest} className="onboard booking-form">
      <input type="hidden" name="lookId" value={lookId} />
      {tech ? <input type="hidden" name="tech" value={tech} /> : null}
      {error ? <p className="notice" role="alert">Add your name and a phone number or Instagram handle so we can confirm.</p> : null}
      <label className="field">Your name<input name="name" required maxLength={80} autoComplete="given-name" /></label>
      <label className="field">Phone or Instagram<input name="contact" required maxLength={80} placeholder="(425) 555-0123 or @yourhandle" /></label>
      <div className="field-row">
        <label className="field">Preferred day <small>optional</small><input type="date" name="date" min={today} /></label>
        <label className="field">Time
          <select name="window" defaultValue="any">
            <option value="any">Any time</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </label>
      </div>
      <label className="field">Note <small>optional</small><textarea name="note" rows={3} maxLength={500} placeholder="Shorter length, skip the accent nail, first visit…" /></label>
      <button type="submit" className="btn btn-primary">Send booking request</button>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>No payment now. We confirm the time with you by message.</p>
    </form>
  );
}
