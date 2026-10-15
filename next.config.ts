import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* This app is fully dynamic and session-gated behind middleware auth, so
     static prerendering / cache components add no value and conflict with
     client-side time-based calculations (equity curve, "now" defaults). */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
