/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse (bundles pdfjs-dist) and mammoth are Node-only parsing
  // libraries used in the /api/parse route handler — keep them out of the
  // client/server-edge bundle by treating them as server-external.
  serverExternalPackages: [
    "pdf-parse",
    "mammoth",
    "bcryptjs",
    "iron-session",
  ],
};

export default nextConfig;
