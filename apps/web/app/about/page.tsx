import { ArrowLeft } from "@/components/Icons";
import { LegalLinks } from "@/components/LegalLinks";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata = {
  title: "About & contact",
  description: "AllTen: see a nail look, book exactly it. Who we are and how to reach us.",
};

export default function About() {
  const mail = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  return (
    <div className="shell">
      <main className="main legal">
        <a className="back" href="/"><ArrowLeft size={18} /> AllTen</a>
        <h1 className="h1">See it. Book exactly it.</h1>
        <p>
          AllTen helps you find a nail look you love and get exactly that at the salon. Every look comes with a full spec:
          the shades, the technique, a fair price and how long it takes, so you and your tech are looking at the same thing.
        </p>

        <h2>How it works</h2>
        <ul>
          <li><strong>Trending, for real.</strong> Each week we check what people are actually searching for and watching, and show the numbers behind a trend.</li>
          <li><strong>Picked for you.</strong> Tell us your hand tone, style and budget, and the looks you save, like and skip tune what you see next.</li>
          <li><strong>The community.</strong> Share your own sets, follow people whose nails you love, and review salons honestly. Every photo is checked by AI and then by a person before it goes live.</li>
          <li><strong>Honest photos.</strong> Some look photos are AI-generated or AI-retouched to show a design on different hands. They&rsquo;re always labeled.</li>
        </ul>

        <h2>Who&rsquo;s behind it</h2>
        <p>
          AllTen is made in Bellevue, Washington, by an engineer who loves fashion, pretty things, and life&rsquo;s small
          moments. A fresh set of nails is one of those: a little joy you see every time you look at your hands, and part of the
          memories you make, from birthdays and weddings to trips and ordinary Tuesdays. We built AllTen so getting that set right is easy.
        </p>

        <h2>Contact us</h2>
        <p>We read every message, usually within a couple of days.</p>
        <ul className="contact-list">
          <li><a href={mail("Feedback")}>Questions &amp; feedback</a></li>
          <li><a href={mail("Salon partnership")}>Salons &amp; nail techs: partner with us</a></li>
          <li><a href={mail("Privacy request")}>Privacy, account or data requests</a></li>
          <li><a href={mail("Copyright or content report")}>Copyright or content reports</a></li>
        </ul>
        <p className="muted">All go to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        <LegalLinks />
      </main>
    </div>
  );
}
