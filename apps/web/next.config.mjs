import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for a lean Docker image.
  output: 'standalone',
  // Pin the trace root to this app so standalone output isn't nested by
  // ancestor lockfiles (server.js lands at .next/standalone/server.js).
  outputFileTracingRoot: dirname,
  // The API base is read at build/runtime from NEXT_PUBLIC_API_URL.
};

export default nextConfig;
