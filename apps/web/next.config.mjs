/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Data comes from the built-in engine (lib/engine) by default; events go to
  // app/api/v1/events. Set USE_REMOTE_API=1 and API_URL to use services/api instead.
};

export default nextConfig;
