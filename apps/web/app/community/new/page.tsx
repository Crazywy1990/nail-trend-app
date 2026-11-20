import { ArrowLeft } from "@/components/Icons";
import { UploadForm } from "@/components/UploadForm";
import { requestUid } from "@/lib/request";
import { getProfile } from "@/lib/store";

export const metadata = { title: "Share your nails" };
export const dynamic = "force-dynamic";

export default async function NewPost() {
  const profile = await getProfile(requestUid());
  return (
    <div className="shell">
      <main className="main">
        <a className="back" href="/community"><ArrowLeft size={18} /> Community</a>
        <header>
          <h1 className="h1">Share your nails</h1>
          <p className="muted">Post a set you had done. Every photo is checked by AI, then by a person, before it goes live.</p>
        </header>
        <UploadForm nickname={profile.nickname ?? ""} />
        <section className="guidelines" aria-labelledby="g">
          <h2 className="h2" id="g" style={{ fontSize: 16 }}>Community guidelines</h2>
          <ul>
            <li>Your own nails, in a photo you took or have the right to share.</li>
            <li>Nails clearly in view. No faces, addresses, phone numbers or other personal info.</li>
            <li>Credit your tech in the caption if you like (no links).</li>
            <li>Be kind. Posts that break these rules are removed.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
