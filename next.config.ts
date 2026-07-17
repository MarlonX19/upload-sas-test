import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
  // FFmpeg WASM is loaded only via dynamic import in the client compress module.
  serverExternalPackages: ["@ffmpeg/ffmpeg", "@ffmpeg/util", "@ffmpeg/core"],
  async headers() {
    return [
      {
        // Avoid sticky immutable cache from the core-mt experiment.
        source: "/ffmpeg/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
