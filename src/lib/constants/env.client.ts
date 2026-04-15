/**
 * Client-safe environment constants.
 *
 * This file only exposes NEXT_PUBLIC_* variables — safe to import in both
 * server and client components.
 */

/** Base URL of the application, e.g. "https://myinvoice.ae" */
export const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
