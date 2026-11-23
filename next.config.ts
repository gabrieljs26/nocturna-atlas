import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "nocturna-atlas-zfsg\\.vercel\\.app" }],
        destination: "https://nocturna-atlas.vercel.app/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
