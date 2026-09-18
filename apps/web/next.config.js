const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@profutbol/shared-types', 'geist'],
  // Hay otros package-lock.json en directorios padre (proyectos hermanos
  // fuera de este repo); sin esto Next infiere mal la raiz del workspace.
  outputFileTracingRoot: path.join(__dirname, '../..'),
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
