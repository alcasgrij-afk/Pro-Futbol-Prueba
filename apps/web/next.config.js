/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@profutbol/shared-types'],
  async rewrites() {
    // En desarrollo, el frontend llama a /api/* y Next.js lo reenvia al
    // backend NestJS, evitando problemas de CORS en local.
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
