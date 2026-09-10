import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // Cesium initialization opens a billable Google 3D root session. React's
  // development-only Strict Mode remount would initialize it twice.
  reactStrictMode: false,
  webpack(config, { webpack }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@spz-loader/core": path.resolve(
        process.cwd(),
        "app/spzLoaderUnsupported.ts",
      ),
    };

    config.plugins.push(
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify("/cesium"),
      }),
    );

    return config;
  },
};

export default nextConfig;
