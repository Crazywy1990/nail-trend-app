import { notFound } from "next/navigation";
import { getLook } from "@/lib/engine";
import { funnel, listBookingRequests } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking requests", robots: { index: false, follow: false } };

/** Concierge inbox. Open with ?key=<ADMIN_KEY>; without ADMIN_KEY set in Vercel the page doesn't exist. */
export default async function Requests({ searchParams }: { searchParams: { key?: string } }) {
  const key = process.env.ADMIN_KEY;
  if (!key || searchParams.key !== key) notFound();
  const [rows, f7] = await Promise.all([listBookingRequests(), funnel(7)]);
  return (
    <div className="shell shell-wide">
      <main className="main">
        <h1 className="h1">Booking requests</h1>
        {f7 ? (
          <p className="muted">Last 7 days: {f7.look_view} look views → {f7.save} saves → {f7.share_tap} shares → {f7.booking_request} booking requests</p>
        ) : null}
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Look</th><th>Tech</th><th>Name</th><th>Contact</th><th>Day / time</th><th>Note</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.createdAt?.slice(0, 16).replace("T", " ")}</td>
                  <td><a href={`/looks/${r.lookId}`}>{getLook(r.lookId)?.name ?? r.lookId}</a></td>
                  <td>{r.techSlug ?? "—"}</td><td>{r.name}</td><td>{r.contact}</td>
                  <td>{r.preferredDate ?? "any day"} · {r.timeWindow}</td><td>{r.note ?? ""}</td><td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? <p className="muted">No requests yet.</p> : null}
      </main>
    </div>
  );
}
