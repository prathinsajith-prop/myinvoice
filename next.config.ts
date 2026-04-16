import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/index.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
};

export default withNextIntl(nextConfig);
