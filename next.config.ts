import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  images: {
    // Protected badge routes must never pass through the shared image cache.
    localPatterns: [
      { pathname: '/achievements/**', search: '' },
      { pathname: '/brand/**', search: '' },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 86400,
    maximumRedirects: 0,
  },
  serverExternalPackages: ['pg', '@prisma/client', '@prisma/adapter-pg'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};
export default config;
