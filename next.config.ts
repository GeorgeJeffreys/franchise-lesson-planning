import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // The per-request message loader reads `messages/<locale>/*.json` from disk at
  // runtime (see `src/i18n/messages.ts`), so the directory must ship with the
  // serverless bundle — Next only traces statically-imported files otherwise.
  outputFileTracingIncludes: {
    "/**": ["./messages/**/*.json"],
  },
};

export default withNextIntl(nextConfig);
