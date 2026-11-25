import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata = { title: "Community guidelines", description: "How to share, comment and review on AllTen." };

export default function Guidelines() {
  return (
    <LegalPage title="Community guidelines">
      <p>AllTen is a place to show off sets, find your next one, and help each other book well. Keep it useful and kind.</p>
      <h2>Posts</h2>
      <ul>
        <li>Share your own nails, in photos you took or have permission to share. Credit your tech in the caption if you like.</li>
        <li>Nails clearly in view, in focus and well lit.</li>
        <li>No faces of other people, and nobody&rsquo;s address, phone number, documents or other personal details.</li>
        <li>No nudity, sexual content, violence or hateful symbols.</li>
        <li>No other accounts&rsquo; watermarks or reposts.</li>
      </ul>
      <h2>Comments</h2>
      <ul>
        <li>Be kind. Critique a set, never a person&rsquo;s body.</li>
        <li>No harassment, slurs, threats or spam, and no links.</li>
      </ul>
      <h2>Reviews</h2>
      <ul>
        <li>Review only salons you actually visited, about your own experience.</li>
        <li>Be specific and fair: how long it lasted, whether you got what you asked for, price, cleanliness, service.</li>
        <li>No reviews of your own business, your employer or competitors, and no paid or incentivized reviews.</li>
        <li>No personal attacks or private details about staff.</li>
      </ul>
      <h2>How we enforce</h2>
      <p>Every uploaded photo is checked by AI and then approved by a person. Comments and reviews are checked automatically, and anything reported by three people is taken down for review. We remove content and may suspend accounts that break these rules.</p>
      <p>See something wrong? Use Report on the post, comment or review, or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
