import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata = { title: "Privacy policy", description: "What AllTen collects, why, who we share it with, and how to delete it." };

export default function Privacy() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Privacy policy">
      <p>AllTen (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps you find nail looks, share your own sets, and book them. This policy explains what we collect, why, who we share it with, and the choices you have. Questions: {mail}.</p>

      <h2>The short version</h2>
      <ul>
        <li>We don&rsquo;t sell your personal information and we don&rsquo;t show ads or use ad trackers.</li>
        <li>Your email is private. Your handle, name, profile, posts, comments and reviews are public.</li>
        <li>You can delete your account, and everything in it, any time in <a href="/settings">Settings</a>.</li>
      </ul>

      <h2>What we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li><strong>Account:</strong> your email address (to send sign-in codes), @handle, display name, and optionally a bio, location, style tags, profile photo and background photo.</li>
        <li><strong>Your preferences:</strong> answers you give in setup, such as hand tone, undertone, jewelry metal, preferred length and shape, and budget. We use hand tone only to show looks on a hand like yours.</li>
        <li><strong>Things you post:</strong> photos of your nails and captions, comments, salon reviews and ratings.</li>
        <li><strong>Booking requests:</strong> the name, contact details, preferred day and time, and notes you enter, and the salon details you save.</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li><strong>Identifiers:</strong> a random ID stored in a cookie so your saves and settings work without an account, and a signed sign-in cookie when you&rsquo;re signed in.</li>
        <li><strong>Activity:</strong> looks and posts you view, save, like, dislike or hide, searches and filters, and taps such as &ldquo;Book&rdquo; and &ldquo;Share&rdquo;. We use this to rank looks for you and to improve the app.</li>
        <li><strong>Approximate location:</strong> our host tells us your rough location from your IP address. We use it only to show nearby salons first when you search, and don&rsquo;t store it. If you allow it in your browser, salon search can use your device location the same way.</li>
        <li><strong>Technical logs:</strong> our host keeps standard request logs (such as IP address, browser type and errors) for security and troubleshooting.</li>
      </ul>
      <p>Photos you upload are re-processed when you upload them, which removes embedded data such as GPS location.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To run AllTen: sign you in, show your saves and profile, and send the booking requests you make.</li>
        <li>To personalize: rank looks and community sets using your answers and activity.</li>
        <li>To keep the community safe: check uploads, comments, reviews and profile text for policy violations, with automated tools and human review.</li>
        <li>To understand what works, using activity data, and to fix problems.</li>
        <li>To contact you about your account or a booking request. We don&rsquo;t send marketing email.</li>
      </ul>

      <h2>What&rsquo;s public</h2>
      <p>Your @handle, display name, profile photo, background photo, bio, location and style tags; your approved posts, comments and reviews; your follower and following lists and counts; and, only if you turn it on, the sets you like and save. Your email, booking requests, preferences and viewing history are never shown to other people.</p>

      <h2>Who we share it with</h2>
      <p>We share information only with service providers that run AllTen for us, under their own privacy and security terms:</p>
      <ul>
        <li><strong>Vercel</strong> hosts the app.</li>
        <li><strong>Neon</strong> hosts our database, including uploaded photos.</li>
        <li><strong>OpenAI</strong> checks uploaded photos, comments, reviews and profile text for safety, and tags nail photos by color, finish and shape. Under OpenAI&rsquo;s API terms this data isn&rsquo;t used to train their models.</li>
        <li><strong>Resend</strong> sends sign-in emails.</li>
        <li><strong>Google Maps Platform</strong> powers salon search. What you type in the salon field is sent to Google.</li>
      </ul>
      <p>When you send a booking request, we share the details needed to book it with the salon or nail tech. We may also disclose information if the law requires it, to protect people&rsquo;s safety, or as part of a sale or reorganization of AllTen, in which case this policy continues to apply.</p>

      <h2>How long we keep it</h2>
      <p>We keep account information and content until you delete them or your account. When you delete your account we delete your profile, posts and photos, comments, reviews, follows, likes, saves, viewing history and booking requests from our database straight away. Copies can remain in our providers&rsquo; backups and logs for a limited time before they&rsquo;re overwritten.</p>

      <h2>Your choices and rights</h2>
      <ul>
        <li><strong>Edit</strong> your profile in <a href="/settings">Settings</a>.</li>
        <li><strong>Delete</strong> your account and its data in <a href="/settings/delete">Settings → Delete account</a>.</li>
        <li><strong>Without an account:</strong> clear your viewing history and reset your answers on the <a href="/profile">Profile</a> page, or clear this site&rsquo;s cookies in your browser.</li>
        <li><strong>Access, correction or deletion requests,</strong> including under California, Washington or other state privacy laws: email {mail}. We&rsquo;ll respond within 45 days and won&rsquo;t treat you differently for asking.</li>
      </ul>

      <h2>Children</h2>
      <p>AllTen isn&rsquo;t for children under 13, and you must be 13 or older to create an account. If you think a child under 13 has given us information, email {mail} and we&rsquo;ll delete it.</p>

      <h2>Security</h2>
      <p>We use HTTPS everywhere, sign-in codes that expire after 10 minutes, and signed sign-in cookies. No system is perfectly secure, so please tell us at {mail} if you notice a problem.</p>

      <h2>Changes</h2>
      <p>If we make important changes we&rsquo;ll update the date above and tell signed-in users in the app.</p>
    </LegalPage>
  );
}
