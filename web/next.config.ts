import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, ".."),
  // The checkout core in ../packages/core is shared with the PayBox plugin and
  // uses NodeNext-style ".js" specifiers for its TypeScript sources.
  webpack(config) {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
};

export default nextConfig;
