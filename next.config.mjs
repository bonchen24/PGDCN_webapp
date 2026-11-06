import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localTmp = path.join(__dirname, '.temp');
if (!fs.existsSync(localTmp)) {
  fs.mkdirSync(localTmp, { recursive: true });
}
process.env.TEMP = localTmp;
process.env.TMP = localTmp;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@resvg/resvg-js'],
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: ['pgdcndev.tvci.id.vn'],
  async redirects() {
    return [
      {
        source: '/pcn/dossiers',
        destination: '/pcn',
        permanent: false,
      },
      {
        source: '/pgd/dossiers',
        destination: '/pgd',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.output.hashFunction = 'xxhash64';
    return config;
  },
};

export default nextConfig;
