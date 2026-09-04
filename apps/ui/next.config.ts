import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async headers() {
    const isolationHeaders = [
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      },
      {
        key: "Cross-Origin-Embedder-Policy",
        value: "require-corp",
      },
    ];

    return [
      {
        source: "/room",
        headers: isolationHeaders,
      },
      {
        source: "/room/:path*",
        headers: isolationHeaders,
      },
    ];
  },
  devIndicators: false,
};

export default nextConfig;
