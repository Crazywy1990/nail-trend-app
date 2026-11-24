import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/Icons";
import { LoginForm } from "@/components/LoginForm";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

const safe = (s?: string) => (s && s.startsWith("/") && !s.startsWith("//") ? s : "/community");

export default async function Login({ searchParams }: { searchParams: { next?: string } }) {
  const next = safe(searchParams.next);
  const user = await currentUser();
  if (user) redirect(user.handle ? next : `/welcome?next=${encodeURIComponent(next)}`);
  return (
    <div className="shell">
      <main className="main">
        <a className="back" href="/"><ArrowLeft size={18} /> AllTen</a>
        <header>
          <h1 className="h1">Sign in</h1>
          <p className="muted">Share your sets, comment, follow people and write salon reviews. Your saves and likes on this device come with you.</p>
        </header>
        <LoginForm next={next} />
      </main>
    </div>
  );
}
