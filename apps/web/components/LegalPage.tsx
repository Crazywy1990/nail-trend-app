import type { ReactNode } from "react";
import { ArrowLeft } from "./Icons";
import { LegalLinks } from "./LegalLinks";
import { LEGAL_UPDATED } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="shell">
      <main className="main legal">
        <a className="back" href="/"><ArrowLeft size={18} /> AllTen</a>
        <h1 className="h1">{title}</h1>
        <p className="muted">Last updated {LEGAL_UPDATED}</p>
        {children}
        <LegalLinks />
      </main>
    </div>
  );
}
