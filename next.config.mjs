/**
 * Static export. When deployed as a GitHub Pages *project* site the app is
 * served under /<repo>/, so the deploy script sets PAGES_BASE_PATH (e.g.
 * "/kolam") and every asset and link is prefixed. Local dev and plain builds
 * leave it unset and serve from the root.
 */
const basePath = process.env.PAGES_BASE_PATH || undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  basePath,
};
export default nextConfig;
