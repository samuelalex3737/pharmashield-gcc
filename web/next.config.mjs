/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // javascript-lp-solver ships an optional external-solver adapter that needs Node built-ins; it is never used in the browser.
      config.resolve.fallback = { ...(config.resolve.fallback ?? {}), fs: false, child_process: false };
    }
    return config;
  },
};

export default nextConfig;
