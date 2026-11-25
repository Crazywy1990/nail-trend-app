import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata = { title: "Terms of use", description: "The rules for using AllTen." };

export default function Terms() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Terms of use">
      <p>These terms are an agreement between you and AllTen (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By using AllTen you agree to them and to our <a href="/privacy">Privacy policy</a> and <a href="/guidelines">Community guidelines</a>. If you don&rsquo;t agree, please don&rsquo;t use AllTen.</p>

      <h2>1. Who can use AllTen</h2>
      <p>You must be at least 13 to create an account, and if you&rsquo;re under 18 you need a parent or guardian&rsquo;s permission. You&rsquo;re responsible for your account and for keeping access to your email secure. One person per account; don&rsquo;t impersonate anyone.</p>

      <h2>2. What AllTen is, and isn&rsquo;t</h2>
      <ul>
        <li>Looks, shade suggestions, prices and appointment times are estimates to help you plan. Salons set their own prices and decide what they can do.</li>
        <li>Some look photos are AI-generated or AI-retouched and are labeled. Real results vary with your nails and the salon.</li>
        <li>Trend figures come from public sources and may be out of date.</li>
        <li>When you send a booking request, we pass it to a salon or tech and try to arrange it. We don&rsquo;t provide nail services and aren&rsquo;t a party to your agreement with the salon. The salon is responsible for its services, hygiene, pricing and policies.</li>
      </ul>

      <h2>3. Your content</h2>
      <p>You keep ownership of the photos, captions, comments, reviews and profile information you post (&ldquo;your content&rdquo;). You give us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, resize, crop, display and distribute your content to run, improve and promote AllTen, including showing it in the app and in previews when people share links. This license ends when you delete the content or your account, except for copies already shared by others or kept for a limited time in backups.</p>
      <p>You promise that you have the right to post your content, that photos are of your own nails or you have permission from the person shown and the photographer, and that your content follows these terms and the guidelines.</p>

      <h2>4. Reviews</h2>
      <p>Reviews must describe your own real experience. Don&rsquo;t review a business you own, work for or compete with, and don&rsquo;t post reviews you were paid or offered something for. Stick to facts and honest opinions; don&rsquo;t make false statements about a salon or a person. You&rsquo;re responsible for your reviews. We may remove reviews that break these rules but we don&rsquo;t edit them, and we don&rsquo;t remove honest negative reviews because a business asks.</p>

      <h2>5. Moderation</h2>
      <p>Uploads are checked by automated tools and a person before they go public. Comments, reviews and profile text are checked automatically and can be reported. We can remove content or suspend accounts that break these terms or the guidelines, or that put people at risk, with or without notice. If you think we got it wrong, email {mail}.</p>

      <h2>6. Things you can&rsquo;t do</h2>
      <ul>
        <li>Break the law or anyone&rsquo;s rights, including copyright and privacy.</li>
        <li>Harass, threaten, spam, or post sexual, violent or hateful content.</li>
        <li>Scrape AllTen, use bots to create accounts or interact, or try to get around limits or security.</li>
        <li>Use AllTen to advertise without our permission.</li>
      </ul>

      <h2>7. Copyright complaints</h2>
      <p>If you believe content on AllTen infringes your copyright, email {mail} with: your contact details; the work you believe is infringed; the link to the content; a statement that you believe in good faith the use isn&rsquo;t authorized; a statement, under penalty of perjury, that your notice is accurate and you&rsquo;re the owner or authorized to act for them; and your signature. We remove infringing content and close accounts of repeat infringers.</p>

      <h2>8. Our content</h2>
      <p>AllTen&rsquo;s design, look specs, text and images (other than your content) belong to us or our licensors. You can share links and share cards from the app; please don&rsquo;t copy our catalog in bulk.</p>

      <h2>9. Ending your account</h2>
      <p>You can delete your account any time in <a href="/settings/delete">Settings</a>. We can suspend or end access if you break these terms. Sections 3 (the license ends as described), 10, 11 and 12 continue after your account ends.</p>

      <h2>10. Disclaimers</h2>
      <p>AllTen is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, including fitness for a particular purpose and non-infringement, to the extent the law allows. We don&rsquo;t guarantee that AllTen will be uninterrupted or error-free, or that any salon will accept a booking or deliver a particular result.</p>

      <h2>11. Limitation of liability</h2>
      <p>To the extent the law allows, AllTen won&rsquo;t be liable for indirect, incidental, special, consequential or punitive damages, or for anything a salon, tech or other user does. Our total liability for any claim relating to AllTen is limited to the greater of $50 or what you paid us in the 12 months before the claim. Some places don&rsquo;t allow these limits, so they may not apply to you.</p>

      <h2>12. Indemnity, law and disputes</h2>
      <p>If your content or your breach of these terms leads to a claim against us, you agree to cover our reasonable costs and losses from it. These terms are governed by the laws of the State of Washington, USA, without regard to conflict-of-law rules. Disputes go to the state or federal courts in King County, Washington, unless the law where you live gives you the right to bring them locally.</p>

      <h2>13. Changes</h2>
      <p>We may update these terms. If changes are important we&rsquo;ll update the date above and tell signed-in users in the app. Continuing to use AllTen after that means you accept the new terms.</p>

      <h2>Contact</h2>
      <p>{mail}</p>
    </LegalPage>
  );
}
