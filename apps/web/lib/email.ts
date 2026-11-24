/**
 * Sends sign-in codes through Resend (https://resend.com, free tier 3,000 emails/month).
 * Env: RESEND_API_KEY, EMAIL_FROM (e.g. "AllTen <login@allten.app>", on a domain verified in Resend).
 * Without EMAIL_FROM it uses Resend's test sender, which can only email the Resend account's own address.
 * Without RESEND_API_KEY, outside production, the code is printed to the server log for local testing.
 */
export const emailConfigured = () => !!process.env.RESEND_API_KEY || process.env.NODE_ENV !== "production" || process.env.ALLTEN_LOCAL_TEST === "1";

export async function sendCode(to: string, code: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production" || process.env.ALLTEN_LOCAL_TEST === "1") {
      console.log(JSON.stringify({ tag: "allten-login-code", to, code }));
      return true;
    }
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "AllTen <onboarding@resend.dev>",
      to: [to],
      subject: `${code} is your AllTen code`,
      text: `Your AllTen sign-in code is ${code}\n\nIt expires in 10 minutes. If you didn't ask for it, ignore this email.`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#3b2418">
        <p>Your AllTen sign-in code:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>
        <p style="color:#7a6658">It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p></div>`,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch((e) => { console.error("[allten] email send failed", e); return null; });
  if (!res?.ok) console.error("[allten] email send failed", res?.status, await res?.text().catch(() => ""));
  return !!res?.ok;
}
