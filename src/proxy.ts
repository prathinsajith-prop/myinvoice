import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** Routes that require the user to be authenticated */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/invoices",
  "/quotes",
  "/customers",
  "/suppliers",
  "/products",
  "/bills",
  "/expenses",
  "/reports",
  "/settings",
  "/onboarding",
];

/** Routes that redirect to /dashboard when already authenticated */
const AUTH_PREFIXES = ["/login", "/register", "/forgot-password"];

function matchesPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = !!token?.sub;

  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);
  const isAuthRoute = matchesPrefix(pathname, AUTH_PREFIXES);

  // Unauthenticated user accessing a protected route → redirect to login
  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user accessing auth routes → redirect to dashboard
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  // Authenticated user on a protected route without an organization
  if (isProtected && isLoggedIn && pathname !== "/onboarding") {
    if (!token.organizationId) {
      return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
    }
  }

  // Inject organization context headers for downstream Server Components / Route Handlers
  if (isLoggedIn && token.organizationId) {
    const response = NextResponse.next();
    response.headers.set("x-organization-id", token.organizationId as string);
    response.headers.set("x-user-id", token.sub ?? "");
    response.headers.set("x-user-role", (token.role as string) ?? "");
    return response;
  }

  return NextResponse.next();
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
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|portal).*)",
  ],
};
