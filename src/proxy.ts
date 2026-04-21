import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { NEXTAUTH_SECRET } from "@/lib/constants/env";
import { SESSION_COOKIE_NAME, USE_SECURE_COOKIES } from "@/lib/auth/cookies";

const PUBLIC_EXACT = ["/"];

const PUBLIC_PREFIXES = [
  "/features",
  "/pricing",
  "/legal",
  "/portal",
  "/accept-invite",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const AUTH_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password"];

function matchesPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

function isPublicPath(path: string): boolean {
  return PUBLIC_EXACT.includes(path) || matchesPrefix(path, PUBLIC_PREFIXES);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const localeMatch = pathname.match(/^\/(?:ar|en)(?=\/|$)/);
  const localeFromPath = localeMatch ? pathname.split("/")[1] as "ar" | "en" : undefined;

  // Resolve locale: prefer URL path prefix, then NEXT_LOCALE cookie, fallback to "en"
  const cookieLocale = req.cookies.get("NEXT_LOCALE")?.value as "ar" | "en" | undefined;
  const activeLocale: "ar" | "en" = localeFromPath ?? (cookieLocale === "ar" ? "ar" : "en");

  // This app uses cookie-based locale (not locale-prefixed routes).
  // Rewrite legacy/accidental locale-prefixed URLs to real routes.
  const normalizedPath = localeFromPath
    ? pathname.replace(/^\/(ar|en)(?=\/|$)/, "") || "/"
    : pathname;

  // API rate limiting (exclude session endpoint — polled frequently by SessionProvider)
  if (normalizedPath.startsWith("/api/") && normalizedPath !== "/api/auth/session") {
    const ip = getClientIp(req.headers);
    const isAuthApi = normalizedPath.startsWith("/api/auth/");
    const isWebhookApi = normalizedPath.startsWith("/api/webhooks/");
    const isExtApi = normalizedPath.startsWith("/api/ext/") || req.headers.has("x-api-secret");
    const limit = isAuthApi ? 60 : isWebhookApi ? 120 : isExtApi ? 200 : 300;
    const windowMs = 15 * 60 * 1000;
    const rl = await rateLimit(`${ip}:${isAuthApi ? "auth" : isWebhookApi ? "webhook" : isExtApi ? "ext-api" : "api"}`, limit, windowMs);

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(rl.remaining),
            "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
          },
        }
      );
    }
  }

  const token = await getToken({
    req,
    secret: NEXTAUTH_SECRET,
    cookieName: SESSION_COOKIE_NAME,
    secureCookie: USE_SECURE_COOKIES,
  });
  const isLoggedIn = !!token?.sub;

  const isPublic = isPublicPath(normalizedPath);
  const isApiRoute = normalizedPath.startsWith("/api/");
  const isProtected = !isPublic && !isApiRoute;
  const isAuthRoute = matchesPrefix(normalizedPath, AUTH_PREFIXES);

  // Unauthenticated user accessing a protected route → redirect to login
  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", normalizedPath);
    const redirectResponse = NextResponse.redirect(loginUrl);

    if (localeFromPath) {
      redirectResponse.cookies.set("NEXT_LOCALE", localeFromPath, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    return redirectResponse;
  }

  // Authenticated user accessing auth routes → redirect to dashboard
  if (isAuthRoute && isLoggedIn) {
    const redirectResponse = NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));

    if (localeFromPath) {
      redirectResponse.cookies.set("NEXT_LOCALE", localeFromPath, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    return redirectResponse;
  }

  // Authenticated user on a protected route without an organization
  if (isProtected && isLoggedIn && normalizedPath !== "/onboarding") {
    if (!token.organizationId) {
      const redirectResponse = NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));

      if (localeFromPath) {
        redirectResponse.cookies.set("NEXT_LOCALE", localeFromPath, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      }

      return redirectResponse;
    }
  }

  const response = localeFromPath
    ? (() => {
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = normalizedPath;
      const rewritten = NextResponse.rewrite(rewriteUrl);
      rewritten.cookies.set("NEXT_LOCALE", localeFromPath, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
      return rewritten;
    })()
    : NextResponse.next();

  // Inject locale header so next-intl's getLocale() / useLocale() resolve correctly
  response.headers.set("X-NEXT-INTL-LOCALE", activeLocale);

  // Inject organization context headers for downstream Server Components / Route Handlers
  if (isLoggedIn && token.organizationId) {
    response.headers.set("x-organization-id", token.organizationId as string);
    response.headers.set("x-user-id", token.sub ?? "");
    response.headers.set("x-user-role", (token.role as string) ?? "");
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     *  - _next/static  (Next.js static assets)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     *  - public files  (any path with a dot extension)
     *  - portal        (public portal routes)
     *
     * NOTE: /api/* routes ARE intentionally included so that
     * rate limiting and auth checks are applied to all API handlers.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|portal).*)",
  ],
};
