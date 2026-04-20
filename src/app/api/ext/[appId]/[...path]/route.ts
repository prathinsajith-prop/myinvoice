/**
 * Catch-all external API route.
 *
 * URL: /api/ext/[appId]/[module]         → list / create
 * URL: /api/ext/[appId]/[module]/[id]    → get / update / delete
 *
 * Authentication: X-Api-Secret header + appId from URL path.
 * All requests are scoped to the app's organization.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveAppContext } from "@/lib/api/app-auth";
import { toErrorResponse } from "@/lib/errors";
import { getModuleConfig } from "@/lib/api/ext-modules";
import prisma from "@/lib/db/prisma";
import { parsePagination } from "@/lib/utils";

type RouteParams = { params: Promise<{ appId: string; path: string[] }> };

/* ────────── helpers ────────── */

function buildSearchFilter(search: string, columns: string[]) {
    if (!search || columns.length === 0) return {};
    return {
        OR: columns.map((col) => ({
            [col]: { contains: search, mode: "insensitive" as const },
        })),
    };
}

/** Fire-and-forget request log */
function logRequest(
    appId: string,
    method: string,
    path: string,
    moduleName: string,
    statusCode: number,
    startMs: number,
    req: NextRequest,
    error?: string,
) {
    prisma.apiRequestLog
        .create({
            data: {
                appId,
                method,
                path,
                module: moduleName,
                statusCode,
                duration: Date.now() - startMs,
                ipAddress:
                    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
                    req.headers.get("x-real-ip") ??
                    null,
                userAgent: req.headers.get("user-agent") ?? null,
                error: error ?? null,
            },
        })
        .catch(() => { });
}

/* ────────── GET ────────── */

export async function GET(req: NextRequest, { params }: RouteParams) {
    const startMs = Date.now();
    let appId = "";
    let moduleName = "";
    try {
        const ctx = await resolveAppContext(req);
        appId = ctx.appId;
        const { path } = await params;

        moduleName = path[0];
        const recordId = path[1]; // optional

        const config = getModuleConfig(moduleName);
        if (!config) {
            logRequest(appId, "GET", req.nextUrl.pathname, moduleName, 404, startMs, req, `Unknown module: ${moduleName}`);
            return NextResponse.json(
                { error: `Unknown module: ${moduleName}` },
                { status: 404 },
            );
        }

        if (recordId) {
            /* ── Single record ── */
            const record = await config.delegate.findFirst({
                where: {
                    id: recordId,
                    organizationId: ctx.organizationId,
                    ...(config.softDelete ? { deletedAt: null } : {}),
                },
                select: config.detailSelect ?? config.listSelect,
            });

            if (!record) {
                logRequest(appId, "GET", req.nextUrl.pathname, moduleName, 404, startMs, req, "Not found");
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }
            logRequest(appId, "GET", req.nextUrl.pathname, moduleName, 200, startMs, req);
            return NextResponse.json({ data: record });
        }

        /* ── List ── */
        const url = new URL(req.url);
        const { page, limit, skip } = parsePagination(url.searchParams);
        const search = url.searchParams.get("search") ?? "";
        const status = url.searchParams.get("status");

        const where = {
            organizationId: ctx.organizationId,
            ...(config.softDelete ? { deletedAt: null } : {}),
            ...(status ? { status } : {}),
            ...buildSearchFilter(search, config.searchColumns),
        };

        const [data, total] = await Promise.all([
            config.delegate.findMany({
                where,
                orderBy: config.orderBy,
                skip,
                take: limit,
                select: config.listSelect,
            }),
            config.delegate.count({ where }),
        ]);

        logRequest(appId, "GET", req.nextUrl.pathname, moduleName, 200, startMs, req);
        return NextResponse.json({
            data,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        const errResp = toErrorResponse(error);
        logRequest(appId, "GET", req.nextUrl.pathname, moduleName, errResp.status, startMs, req, String(error));
        return errResp;
    }
}

/* ────────── POST ────────── */

export async function POST(req: NextRequest, { params }: RouteParams) {
    const startMs = Date.now();
    let appId = "";
    let moduleName = "";
    try {
        const ctx = await resolveAppContext(req);
        appId = ctx.appId;
        const { path } = await params;

        moduleName = path[0];
        const config = getModuleConfig(moduleName);
        if (!config) {
            logRequest(appId, "POST", req.nextUrl.pathname, moduleName, 404, startMs, req, `Unknown module: ${moduleName}`);
            return NextResponse.json(
                { error: `Unknown module: ${moduleName}` },
                { status: 404 },
            );
        }

        const body = await req.json();

        let record;
        try {
            if (config.createFn) {
                // Module-specific creation logic (handles auto-numbering, computed fields, etc.)
                record = await config.createFn(body, ctx.organizationId);
            } else {
                // Generic path: strip unknown fields then call Prisma create
                const safeBody = config.allowedWriteFields
                    ? Object.fromEntries(
                        Object.entries(body).filter(([k]) => config.allowedWriteFields!.includes(k)),
                    )
                    : body;

                record = await config.delegate.create({
                    data: {
                        ...safeBody,
                        organizationId: ctx.organizationId,
                    },
                });
            }
        } catch (createErr: unknown) {
            // P2002 = unique constraint violation
            if ((createErr as { code?: string })?.code === "P2002") {
                logRequest(appId, "POST", req.nextUrl.pathname, moduleName, 409, startMs, req, "Duplicate record");
                return NextResponse.json(
                    { error: "A record with this value already exists (duplicate)", code: "CONFLICT" },
                    { status: 409 },
                );
            }
            throw createErr;
        }

        logRequest(appId, "POST", req.nextUrl.pathname, moduleName, 201, startMs, req);
        return NextResponse.json({ data: record }, { status: 201 });
    } catch (error) {
        const errResp = toErrorResponse(error);
        logRequest(appId, "POST", req.nextUrl.pathname, moduleName, errResp.status, startMs, req, String(error));
        return errResp;
    }
}

/* ────────── PATCH ────────── */

export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const startMs = Date.now();
    let appId = "";
    let moduleName = "";
    try {
        const ctx = await resolveAppContext(req);
        appId = ctx.appId;
        const { path } = await params;

        moduleName = path[0];
        const recordId = path[1];
        if (!recordId) {
            logRequest(appId, "PATCH", req.nextUrl.pathname, moduleName, 400, startMs, req, "Record ID required");
            return NextResponse.json(
                { error: "Record ID required in URL path" },
                { status: 400 },
            );
        }

        const config = getModuleConfig(moduleName);
        if (!config) {
            logRequest(appId, "PATCH", req.nextUrl.pathname, moduleName, 404, startMs, req, `Unknown module: ${moduleName}`);
            return NextResponse.json(
                { error: `Unknown module: ${moduleName}` },
                { status: 404 },
            );
        }

        // Verify ownership
        const existing = await config.delegate.findFirst({
            where: {
                id: recordId,
                organizationId: ctx.organizationId,
                ...(config.softDelete ? { deletedAt: null } : {}),
            },
        });
        if (!existing) {
            logRequest(appId, "PATCH", req.nextUrl.pathname, moduleName, 404, startMs, req, "Not found");
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const body = await req.json();
        // Prevent org switching
        delete body.organizationId;
        delete body.id;

        // Strip unknown fields if allowedWriteFields is defined
        const safeBody = config.allowedWriteFields
            ? Object.fromEntries(
                Object.entries(body).filter(([k]) => config.allowedWriteFields!.includes(k)),
            )
            : body;

        let updated;
        try {
            updated = await config.delegate.update({
                where: { id: recordId },
                data: safeBody,
            });
        } catch (updateErr: unknown) {
            if ((updateErr as { code?: string })?.code === "P2002") {
                logRequest(appId, "PATCH", req.nextUrl.pathname, moduleName, 409, startMs, req, "Duplicate record");
                return NextResponse.json(
                    { error: "A record with this value already exists (duplicate)", code: "CONFLICT" },
                    { status: 409 },
                );
            }
            throw updateErr;
        }

        logRequest(appId, "PATCH", req.nextUrl.pathname, moduleName, 200, startMs, req);
        return NextResponse.json({ data: updated });
    } catch (error) {
        const errResp = toErrorResponse(error);
        logRequest(appId, "PATCH", req.nextUrl.pathname, moduleName, errResp.status, startMs, req, String(error));
        return errResp;
    }
}

/* ────────── PUT (alias for PATCH) ────────── */

export async function PUT(req: NextRequest, { params }: RouteParams) {
    return PATCH(req, { params });
}

/* ────────── DELETE ────────── */

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const startMs = Date.now();
    let appId = "";
    let moduleName = "";
    try {
        const ctx = await resolveAppContext(req);
        appId = ctx.appId;
        const { path } = await params;

        moduleName = path[0];
        const recordId = path[1];
        if (!recordId) {
            logRequest(appId, "DELETE", req.nextUrl.pathname, moduleName, 400, startMs, req, "Record ID required");
            return NextResponse.json(
                { error: "Record ID required in URL path" },
                { status: 400 },
            );
        }

        const config = getModuleConfig(moduleName);
        if (!config) {
            logRequest(appId, "DELETE", req.nextUrl.pathname, moduleName, 404, startMs, req, `Unknown module: ${moduleName}`);
            return NextResponse.json(
                { error: `Unknown module: ${moduleName}` },
                { status: 404 },
            );
        }

        // Verify ownership
        const existing = await config.delegate.findFirst({
            where: {
                id: recordId,
                organizationId: ctx.organizationId,
                ...(config.softDelete ? { deletedAt: null } : {}),
            },
        });
        if (!existing) {
            logRequest(appId, "DELETE", req.nextUrl.pathname, moduleName, 404, startMs, req, "Not found");
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (config.softDelete) {
            await config.delegate.update({
                where: { id: recordId },
                data: { deletedAt: new Date() },
            });
        } else {
            logRequest(appId, "DELETE", req.nextUrl.pathname, moduleName, 405, startMs, req, "Delete not supported");
            return NextResponse.json(
                { error: "Delete not supported for this module" },
                { status: 405 },
            );
        }

        logRequest(appId, "DELETE", req.nextUrl.pathname, moduleName, 200, startMs, req);
        return NextResponse.json({ success: true });
    } catch (error) {
        const errResp = toErrorResponse(error);
        logRequest(appId, "DELETE", req.nextUrl.pathname, moduleName, errResp.status, startMs, req, String(error));
        return errResp;
    }
}
