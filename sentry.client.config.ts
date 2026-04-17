import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  debug: process.env.NODE_ENV === "development",

  // Source maps
  attachStacktrace: true,

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",

  // Ignore certain errors
  beforeSend(event, hint) {
    // Ignore known browser extensions
    if (event.exception) {
      const error = hint.originalException;
      if (
        error instanceof Error &&
        (error.message?.includes("chrome-extension") ||
          error.message?.includes("moz-extension"))
      ) {
        return null;
      }
    }
    return event;
  },

  integrations: [],
});
