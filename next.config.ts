import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // Cesium initialization opens a billable Google 3D root session. React's
  // development-only Strict Mode remount would initialize it twice.
  reactStrictMode: false,
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify("/cesium"),
      }),
    );

    return config;
  },
};

export default nextConfig;
