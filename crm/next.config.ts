import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-*.r2.dev",
      },
    ],
  },
};

// Cho phép `next dev` truy cập binding Cloudflare thật (D1, R2) thông qua
// wrangler khi phát triển local. Không ảnh hưởng tới build production.
initOpenNextCloudflareForDev();

export default nextConfig;
