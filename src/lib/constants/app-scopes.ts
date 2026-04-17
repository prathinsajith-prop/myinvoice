/**
 * Available modules that can be scoped to a connected app key.
 * Each module supports read / write / delete granularity.
 */
export const APP_MODULES = [
    "invoices",
    "quotations",
    "credit-notes",
    "debit-notes",
    "delivery-notes",
    "recurring-invoices",
    "customers",
    "bills",
    "purchase-orders",
    "suppliers",
    "expenses",
    "products",
    "payments",
    "reports",
    "vat-returns",
    "organization",
] as const;

export type AppModule = (typeof APP_MODULES)[number];

export const SCOPE_ACTIONS = ["read", "write", "delete"] as const;
export type ScopeAction = (typeof SCOPE_ACTIONS)[number];

/** e.g. "invoices:read", "customers:write" */
export type Scope = `${AppModule}:${ScopeAction}`;

/** HTTP methods that can be restricted per-app. */
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** Map scope action to allowed HTTP methods. */
export const SCOPE_ACTION_METHOD_MAP: Record<ScopeAction, HttpMethod[]> = {
    read: ["GET"],
    write: ["POST", "PUT", "PATCH"],
    delete: ["DELETE"],
};

/** Derive all valid scopes for the UI. */
export function getAllScopes(): Scope[] {
    const scopes: Scope[] = [];
    for (const mod of APP_MODULES) {
        for (const action of SCOPE_ACTIONS) {
            scopes.push(`${mod}:${action}`);
        }
    }
    return scopes;
}

/**
 * Check whether a request (module + method) is allowed by the app's scopes.
 *
 * @param scopes  The app's granted scopes, e.g. ["invoices:read", "invoices:write"]
 * @param module  The resource being accessed, e.g. "invoices"
 * @param method  The HTTP method, e.g. "GET"
 */
export function isScopeAllowed(
    scopes: string[],
    module: string,
    method: string,
): boolean {
    const upperMethod = method.toUpperCase() as HttpMethod;

    for (const scope of scopes) {
        const [scopeModule, scopeAction] = scope.split(":") as [
            string,
            ScopeAction,
        ];
        if (scopeModule !== module) continue;

        const allowedMethods = SCOPE_ACTION_METHOD_MAP[scopeAction];
        if (allowedMethods?.includes(upperMethod)) return true;
    }

    return false;
}

/**
 * Map a URL path segment to the module name for scope checks.
 * Supports:
 *   /api/ext/<appId>/<module>/…  → module
 *   /api/<module>/…              → module
 */
export function extractModuleFromPath(pathname: string): string | null {
    // External API: /api/ext/<appId>/<module>
    const extMatch = pathname.match(/^\/api\/ext\/[^/]+\/([a-z-]+)/);
    if (extMatch) return extMatch[1];

    // Internal API: /api/<module>
    const match = pathname.match(/^\/api\/([a-z-]+)/);
    return match ? match[1] : null;
}
