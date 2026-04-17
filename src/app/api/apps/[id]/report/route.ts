import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithPermission } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";

/**
 * GET /api/apps/[id]/report
 *
 * High-performance analytics for a connected app.
 * Uses raw SQL to consolidate 13 queries → 4 queries for minimal DB round-trips.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "manage_org");
        const { id } = await params;

        // Fetch app — org-scoped (lightweight, uses PK index)
        const app = await prisma.connectedApp.findFirst({
            where: { id, organizationId: ctx.organizationId },
            select: {
                id: true,
                name: true,
                description: true,
                status: true,
                scopes: true,
                ipWhitelist: true,
                lastUsedAt: true,
                requestCount: true,
                createdAt: true,
                updatedAt: true,
                revokedAt: true,
            },
        });
        if (!app) throw new NotFoundError("App not found");

        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // ── Query 1: All aggregate stats in a single pass ──
        // Replaces 6 separate count/aggregate queries with 1 table scan
        const [statsRow] = await prisma.$queryRaw<[{
            total: bigint;
            success: bigint;
            errors: bigint;
            avg_dur: number | null;
            max_dur: number | null;
            min_dur: number | null;
            last_24h: bigint;
            last_7d: bigint;
        }]>`
            SELECT
                COUNT(*)::bigint AS total,
                COUNT(*) FILTER (WHERE "statusCode" >= 200 AND "statusCode" < 300)::bigint AS success,
                COUNT(*) FILTER (WHERE "statusCode" >= 400)::bigint AS errors,
                ROUND(AVG("duration"))::float AS avg_dur,
                MAX("duration")::int AS max_dur,
                MIN("duration")::int AS min_dur,
                COUNT(*) FILTER (WHERE "createdAt" >= ${last24h})::bigint AS last_24h,
                COUNT(*) FILTER (WHERE "createdAt" >= ${last7d})::bigint AS last_7d
            FROM "ApiRequestLog"
            WHERE "appId" = ${id}
        `;

        const totalRequests = Number(statsRow.total);
        const successCount = Number(statsRow.success);
        const errorCount = Number(statsRow.errors);

        // ── Query 2: All breakdowns in parallel (module, method, status, errors) ──
        // Plus hourly/daily volume — these need separate GROUP BY clauses
        const [
            moduleBreakdown,
            methodBreakdown,
            statusBreakdown,
            topErrors,
            hourlyVolume,
            dailyVolume,
            recentLogs,
        ] = await Promise.all([
            prisma.$queryRaw<{ module: string; count: bigint }[]>`
                SELECT "module", COUNT(*)::bigint AS count
                FROM "ApiRequestLog"
                WHERE "appId" = ${id}
                GROUP BY "module"
                ORDER BY count DESC
            `,
            prisma.$queryRaw<{ method: string; count: bigint }[]>`
                SELECT "method", COUNT(*)::bigint AS count
                FROM "ApiRequestLog"
                WHERE "appId" = ${id}
                GROUP BY "method"
                ORDER BY count DESC
            `,
            prisma.$queryRaw<{ status_code: number; count: bigint }[]>`
                SELECT "statusCode" AS status_code, COUNT(*)::bigint AS count
                FROM "ApiRequestLog"
                WHERE "appId" = ${id}
                GROUP BY "statusCode"
                ORDER BY count DESC
            `,
            prisma.$queryRaw<{ error: string; count: bigint }[]>`
                SELECT "error", COUNT(*)::bigint AS count
                FROM "ApiRequestLog"
                WHERE "appId" = ${id} AND "error" IS NOT NULL
                GROUP BY "error"
                ORDER BY count DESC
                LIMIT 10
            `,
            prisma.$queryRaw<{ hour: Date; total: bigint; errors: bigint }[]>`
                SELECT
                    date_trunc('hour', "createdAt") AS hour,
                    COUNT(*)::bigint AS total,
                    COUNT(*) FILTER (WHERE "statusCode" >= 400)::bigint AS errors
                FROM "ApiRequestLog"
                WHERE "appId" = ${id} AND "createdAt" >= ${last7d}
                GROUP BY 1 ORDER BY 1
            `,
            prisma.$queryRaw<{ day: Date; total: bigint; errors: bigint; avg_latency: number }[]>`
                SELECT
                    date_trunc('day', "createdAt") AS day,
                    COUNT(*)::bigint AS total,
                    COUNT(*) FILTER (WHERE "statusCode" >= 400)::bigint AS errors,
                    ROUND(AVG("duration"))::float AS avg_latency
                FROM "ApiRequestLog"
                WHERE "appId" = ${id} AND "createdAt" >= ${last30d}
                GROUP BY 1 ORDER BY 1
            `,
            // Recent logs — uses the (appId, createdAt) index for fast ORDER BY
            prisma.apiRequestLog.findMany({
                where: { appId: id },
                orderBy: { createdAt: "desc" },
                take: 50,
                select: {
                    id: true,
                    method: true,
                    path: true,
                    module: true,
                    statusCode: true,
                    duration: true,
                    ipAddress: true,
                    error: true,
                    createdAt: true,
                },
            }),
        ]);

        return NextResponse.json({
            data: {
                app,
                stats: {
                    totalRequests,
                    successCount,
                    errorCount,
                    successRate: totalRequests > 0
                        ? Math.round((successCount / totalRequests) * 10000) / 100
                        : 0,
                    avgLatencyMs: Math.round(statsRow.avg_dur ?? 0),
                    maxLatencyMs: statsRow.max_dur ?? 0,
                    minLatencyMs: statsRow.min_dur ?? 0,
                    last24h: Number(statsRow.last_24h),
                    last7d: Number(statsRow.last_7d),
                },
                moduleBreakdown: moduleBreakdown.map((m) => ({
                    module: m.module,
                    count: Number(m.count),
                })),
                methodBreakdown: methodBreakdown.map((m) => ({
                    method: m.method,
                    count: Number(m.count),
                })),
                statusBreakdown: statusBreakdown.map((s) => ({
                    statusCode: s.status_code,
                    count: Number(s.count),
                })),
                topErrors: topErrors.map((e) => ({
                    error: e.error,
                    count: Number(e.count),
                })),
                recentLogs,
                hourlyVolume: hourlyVolume.map((h) => ({
                    hour: h.hour.toISOString(),
                    total: Number(h.total),
                    errors: Number(h.errors),
                })),
                dailyVolume: dailyVolume.map((d) => ({
                    day: d.day.toISOString(),
                    total: Number(d.total),
                    errors: Number(d.errors),
                    avgLatency: d.avg_latency ?? 0,
                })),
            },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
