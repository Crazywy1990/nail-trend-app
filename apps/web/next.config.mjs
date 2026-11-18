/**
 * Public site address used in every shared link. SITE_URL wins (set it to https://allten.app once
 * the domain is connected); otherwise Vercel's production domain. Never the per-deployment URL,
 * which sits behind Vercel's login wall.
 */
const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const SITE_ORIGIN = (process.env.SITE_URL || (prod ? `https://${prod}` : "http://localhost:3000")).replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_SITE_ORIGIN: SITE_ORIGIN },
  // Data comes from the built-in engine (lib/engine) by default; events go to
  // app/api/v1/events. Set USE_REMOTE_API=1 and API_URL to use services/api instead.
};

export default nextConfig;
