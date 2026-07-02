import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', 'pdfjs-dist', 'unpdf'],
  turbopack: {},
};

export default nextConfig;
