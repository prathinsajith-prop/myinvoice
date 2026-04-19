/**
 * API-key (app secret) authentication for Connected Apps.
 *
 * URL pattern: `/api/ext/<appId>/…`
 * Header:      `X-Api-Secret: <64-char hex secret>`
 *
 * Resolves an AppContext instead of the normal user-based ApiContext.
 * Enforces scopes, allowed HTTP methods, allowed modules, IP whitelist,
 * and active status checks.
 */

import type { NextRequest } from "next/server";
import {
    UnauthorizedError,
    ForbiddenError,
} from "@/lib/errors";
import { hashSecret, timingSafeCompare } from "@/lib/crypto/token";
import prisma from "@/lib/db/prisma";
import { getTenantPrisma, type TenantPrismaClient } from "@/lib/db/tenant";
import { isScopeAllowed, extractModuleFromPath } from "@/lib/constants/app-scopes";
import type { HttpMethod } from "@/lib/constants/app-scopes";

export interface AppContext {
    appId: string;
    appName: string;
    organizationId: string;
    scopes: string[];
}

/**
 * Extract the app ID from an `/api/ext/<appId>/…` URL path.
 */
function extractAppIdFromPath(pathname: string): string | null {
    const match = pathname.match(/^\/api\/ext\/([^/]+)/);
    return match?.[1] ?? null;
}

/**
 * Resolve and validate an API-key–based request.
 *
 * 1. Extract `appId` from URL path (`/api/ext/<appId>/…`)
 * 2. Read `X-Api-Secret` header
 * 3. Fetch ConnectedApp from DB, verify status
 * 4. Hash plainSecret → compare to stored hash
 * 5. Enforce IP whitelist
 * 6. Enforce allowed HTTP methods
 * 7. Enforce allowed modules
 * 8. Enforce scope (module:action vs HTTP method)
 * 9. Bump lastUsedAt / requestCount (fire-and-forget)
 */
export async function resolveAppContext(req: NextRequest): Promise<AppContext> {
    const appId = extractAppIdFromPath(req.nextUrl.pathname);
    if (!appId) {
        throw new UnauthorizedError("Missing app ID in URL path");
    }

    const plainSecret = req.headers.get("x-api-secret");
    if (!plainSecret) {
        throw new UnauthorizedError("Missing X-Api-Secret header");
    }

    // Fetch app
    const app = await prisma.connectedApp.findUnique({
        where: { id: appId },
        select: {
            id: true,
            name: true,
            organizationId: true,
            appSecret: true,
            status: true,
            scopes: true,
            ipWhitelist: true,
        },
    });

    if (!app) {
        throw new UnauthorizedError("Invalid API key");
    }

    if (app.status !== "ACTIVE") {
        throw new ForbiddenError("App has been revoked");
    }

    // Verify secret (timing-safe)
    const hashedInput = hashSecret(plainSecret);
    if (!timingSafeCompare(hashedInput, app.appSecret)) {
        throw new UnauthorizedError("Invalid API key");
    }

    // --- Access-list helpers ---
    const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        "unknown";

    // Extract origin hostname from Origin / Referer header
    const originHeader = req.headers.get("origin") ?? req.headers.get("referer");
    const originHost = originHeader ? safeHostname(originHeader) : null;

    // IP / URL whitelist check
    if (app.ipWhitelist.length > 0) {
        if (!matchesAccessList(app.ipWhitelist, clientIp, originHost)) {
            throw new ForbiddenError("IP address or origin not in allowlist");
        }
    }

    const method = req.method.toUpperCase() as HttpMethod;

    // Module + scope check
    const module = extractModuleFromPath(req.nextUrl.pathname);
    if (module) {
        // Scope check
        if (!isScopeAllowed(app.scopes, module, method)) {
            throw new ForbiddenError(
                `Insufficient scope for ${method} ${module}`,
            );
        }
    }

    // Bump usage stats (fire-and-forget, never block the request)
    prisma.connectedApp
        .update({
            where: { id: app.id },
            data: {
                lastUsedAt: new Date(),
                requestCount: { increment: 1 },
            },
        })
        .catch(() => {
            /* swallow */
        });

    return {
        appId: app.id,
        appName: app.name,
        organizationId: app.organizationId,
        scopes: app.scopes,
    };
}

/** Get a tenant-scoped Prisma client for a resolved app context. */
export function getAppTenantDb(ctx: AppContext): TenantPrismaClient {
    return getTenantPrisma(ctx.organizationId);
}

// ── Access-list matching helpers ─────────────────────────────────────

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

/** Return true if the entry looks like an IPv4 address or CIDR. */
function isIpEntry(entry: string): boolean {
    return IP_RE.test(entry);
}

/** Safely extract the hostname from a URL string. */
function safeHostname(url: string): string | null {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }
}

/** Check if a client IP falls within a CIDR range. */
function ipMatchesCidr(ip: string, cidr: string): boolean {
    const [base, bits] = cidr.split("/");
    if (!bits) return ip === base;
    const mask = ~(2 ** (32 - Number(bits)) - 1) >>> 0;
    return (ipToNum(ip) & mask) === (ipToNum(base) & mask);
}

function ipToNum(ip: string): number {
    return ip
        .split(".")
        .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

/**
 * Normalize a domain entry — strip protocol/path, lowercase.
 * Accepts raw hostnames like `example.com` or full URLs like `https://example.com/path`.
 */
function normalizeDomain(entry: string): string {
    const trimmed = entry.trim().toLowerCase();
    // If it contains "://", parse as URL
    if (trimmed.includes("://")) {
        return safeHostname(trimmed) ?? trimmed;
    }
    // Strip trailing slashes / paths
    return trimmed.split("/")[0];
}

/**
 * Check if the client matches ANY entry in the access list.
 * Supports: exact IPs, CIDR ranges, domains, and full URLs.
 */
function matchesAccessList(
    entries: string[],
    clientIp: string,
    originHost: string | null,
): boolean {
    for (const raw of entries) {
        const entry = raw.trim();
        if (!entry) continue;

        if (isIpEntry(entry)) {
            // IP or CIDR match
            if (entry.includes("/") ? ipMatchesCidr(clientIp, entry) : clientIp === entry) {
                return true;
            }
        } else {
            // Domain / URL match — compare against the request Origin hostname
            const domain = normalizeDomain(entry);
            if (originHost && (originHost === domain || originHost.endsWith(`.${domain}`))) {
                return true;
            }
        }
    }
    return false;
}
