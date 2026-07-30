/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse pulls in pdfjs-dist's legacy build, which breaks when webpack tries to bundle
  // it for the server (throws "Object.defineProperty called on non-object" at import time,
  // taking down the whole /api/profile/parse route). Excluding it from bundling so Node
  // requires it natively at runtime instead.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
  },
};

export default nextConfig;
