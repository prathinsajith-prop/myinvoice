import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const isEdge = process.env.NEXT_RUNTIME === "edge";

/**
 * Application-wide structured logger.
 *
 * In development: pretty-prints with colours via pino-pretty.
 * In production:  emits JSON (compatible with Vercel log drain, Datadog, Logtail, etc.).
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ invoiceId }, "Invoice created");
 *   logger.error({ err, userId }, "Payment failed");
 */
const logger = pino(
    {
        level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
        // Redact sensitive fields before they reach log sinks
        redact: {
            paths: [
                "password",
                "passwordHash",
                "secret",
                "token",
                "accessToken",
                "refreshToken",
                "stripeSecretKey",
                "stripeSecretKeyHash",
                "*.password",
                "*.secret",
                "*.token",
                "req.headers.authorization",
                "req.headers.cookie",
            ],
            censor: "[REDACTED]",
        },
        base: {
            env: process.env.NODE_ENV,
        },
        formatters: {
            level(label) {
                return { level: label };
            },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    // pino-pretty only in dev; skip in edge runtime (no Node streams)
    isDev && !isEdge
        ? pino.transport({
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "HH:MM:ss",
                ignore: "pid,hostname,env",
            },
        })
        : undefined
);

export { logger };

/**
 * Create a child logger bound to a specific request context.
 * Use this at the top of each API route handler for traceable logs.
 *
 * @example
 * const log = requestLogger(req, "invoices");
 * log.info({ invoiceId }, "Invoice fetched");
 */
export function requestLogger(req: { headers: Headers | Record<string, string | string[] | undefined> }, module: string) {
    const headers = req.headers instanceof Headers ? req.headers : new Headers(req.headers as Record<string, string>);
    return logger.child({
        module,
        requestId: headers.get("x-request-id") ?? crypto.randomUUID(),
        ip: headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? "unknown",
    });
}
