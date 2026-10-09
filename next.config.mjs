/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Prevent ESLint warnings/checks from breaking the Vercel production build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep strict TypeScript checking active
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
