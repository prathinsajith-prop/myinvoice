import { getRequestConfig } from "next-intl/server";

// Supported locales
export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

// Default locale
export const defaultLocale: Locale = "en";

// RTL locales
export const rtlLocales: Locale[] = ["ar"];

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Resolve locale from the header injected by proxy.ts; fallback to default
  const resolved = await requestLocale;
  const locale: Locale = locales.includes(resolved as Locale)
    ? (resolved as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
