import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./index";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed", // Only show locale prefix for non-default locale
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
