import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./index";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "never", // Never prefix URLs — locale resolved from NEXT_LOCALE cookie
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
