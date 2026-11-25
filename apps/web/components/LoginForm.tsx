"use client";

import { useState } from "react";

/** Email → 6-digit code → signed in. New accounts go on to pick a @handle. */
export function LoginForm({ next }: { next: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, json: (await res.json().catch(() => ({}))) as { error?: string; needsHandle?: boolean } };
  };
  const send = async () => {
    setBusy(true); setError(null);
    const r = await post("/api/v1/auth/code", { email });
    setBusy(false);
    if (!r.ok) { setError(r.json.error || "Something went wrong."); return; }
    setStep("code"); setNote(`We sent a 6-digit code to ${email}. Check spam if you don't see it.`);
  };

  return step === "email" ? (
    <form className="onboard" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <label className="field">Email
        <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>
      {error ? <p className="notice" role="alert">{error}</p> : null}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>No password. Your email is never shown to anyone. By continuing you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy policy</a>, and confirm you&rsquo;re 13 or older.</p>
    </form>
  ) : (
    <form className="onboard" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      const r = await post("/api/v1/auth/verify", { email, code });
      if (!r.ok) { setBusy(false); setError(r.json.error || "Something went wrong."); return; }
      window.location.href = r.json.needsHandle ? `/welcome?next=${encodeURIComponent(next)}` : next;
    }}>
      {note ? <p className="notice" role="status">{note}</p> : null}
      <label className="field">6-digit code
        <input required autoComplete="one-time-code" inputMode="numeric" pattern="\d{6}" maxLength={6} value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="code-input" autoFocus />
      </label>
      {error ? <p className="notice" role="alert">{error}</p> : null}
      <button className="btn btn-primary" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
      <div className="actions-row" style={{ gap: 16 }}>
        <button type="button" className="link-btn" onClick={send} disabled={busy}>Send a new code</button>
        <button type="button" className="link-btn" onClick={() => { setStep("email"); setCode(""); setError(null); }}>Use a different email</button>
      </div>
    </form>
  );
}
