import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Keep static-generation workers below the machine-wide default.
    // The compare/alternatives route families prerender large batches and
    // otherwise intermittently exceed Next.js per-page build timeouts.
    staticGenerationMaxConcurrency: 4,
    staticGenerationMinPagesPerWorker: 10,
    staticGenerationRetryCount: 1,
  },
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.producthunt.com' },
      { protocol: 'https', hostname: '**.ph-cdn.com' }
    ]
  }
};

export default nextConfig;
