import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: process.env.NODE_ENV === "development",

    // Source maps
    attachStacktrace: true,

    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",

    // Profiling
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Ignore certain errors
    beforeSend(event, hint) {
        const error = hint.originalException;
        // Ignore specific known errors
        if (error instanceof Error) {
            // Ignore network timeouts in dev
            if (
                process.env.NODE_ENV === "development" &&
                error.message?.includes("ECONNREFUSED")
            ) {
                return null;
            }
        }
        return event;
    },

    integrations: [],
});
