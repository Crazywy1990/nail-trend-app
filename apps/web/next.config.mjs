const API_URL = process.env.API_URL || "http://127.0.0.1:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Browser calls /api/v1/* on the same origin; Next proxies to the FastAPI service.
    return [{ source: "/api/v1/:path*", destination: `${API_URL}/v1/:path*` }];
  },
};

export default nextConfig;
