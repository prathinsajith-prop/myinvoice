/**
 * Authoritative Auth.js cookie configuration.
 *
 * Centralizes cookie names + security flags so middleware (`proxy.ts`),
 * API helpers (`lib/api/auth.ts`), and the NextAuth config all agree.
 * Behind a reverse proxy/CDN that terminates TLS, Auth.js's per-request
 * HTTPS auto-detection fails, so we pin everything based on NODE_ENV.
 */

const isProd = process.env.NODE_ENV === "production";

export const SESSION_COOKIE_NAME = isProd
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

export const CALLBACK_COOKIE_NAME = isProd
    ? "__Secure-authjs.callback-url"
    : "authjs.callback-url";

export const CSRF_COOKIE_NAME = isProd
    ? "__Host-authjs.csrf-token"
    : "authjs.csrf-token";

export const USE_SECURE_COOKIES = isProd;

/** Cookie config object passed to NextAuthConfig.cookies. */
export const authCookieConfig = {
    sessionToken: {
        name: SESSION_COOKIE_NAME,
        options: {
            httpOnly: true,
            sameSite: "lax" as const,
            path: "/",
            secure: USE_SECURE_COOKIES,
        },
    },
    callbackUrl: {
        name: CALLBACK_COOKIE_NAME,
        options: {
            sameSite: "lax" as const,
            path: "/",
            secure: USE_SECURE_COOKIES,
        },
    },
    csrfToken: {
        name: CSRF_COOKIE_NAME,
        options: {
            httpOnly: true,
            sameSite: "lax" as const,
            path: "/",
            secure: USE_SECURE_COOKIES,
        },
    },
};
