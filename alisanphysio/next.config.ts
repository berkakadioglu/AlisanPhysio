import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF export routes read bundled .ttf font files at runtime with
  // fs/process.cwd(). Next's output file tracing doesn't detect those reads,
  // so include them explicitly or the fonts are missing on Vercel.
  outputFileTracingIncludes: {
    "/admin/export/**": ["./src/lib/pdf/fonts/**"],
  },
};

export default nextConfig;
