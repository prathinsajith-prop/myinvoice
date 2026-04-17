export interface LoginAttemptMetadata {
    ipAddress?: string | null;
    userAgent?: string | null;
    device?: string | null;
    browser?: string | null;
    os?: string | null;
    city?: string | null;
    country?: string | null;
}

function detectBrowser(userAgent: string): string | null {
    if (/Edg\//i.test(userAgent)) return "Edge";
    if (/OPR\//i.test(userAgent)) return "Opera";
    if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return "Chrome";
    if (/Firefox\//i.test(userAgent)) return "Firefox";
    if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return "Safari";
    return null;
}

function detectOs(userAgent: string): string | null {
    if (/Windows NT/i.test(userAgent)) return "Windows";
    if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
    if (/Android/i.test(userAgent)) return "Android";
    if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
    if (/Linux/i.test(userAgent)) return "Linux";
    return null;
}

function detectDevice(userAgent: string): string | null {
    if (/bot|crawler|spider|crawling/i.test(userAgent)) return "Bot";
    if (/iPad|Tablet/i.test(userAgent)) return "Tablet";
    if (/Mobile|Android|iPhone|iPod/i.test(userAgent)) return "Mobile";
    return "Desktop";
}

export function getRequestMetadataFromHeaders(headers?: Headers): LoginAttemptMetadata {
    if (!headers) {
        return {};
    }

    const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ipAddress =
        forwardedFor ||
        headers.get("x-real-ip") ||
        headers.get("cf-connecting-ip") ||
        null;

    const userAgent = headers.get("user-agent") || null;
    const browser = userAgent ? detectBrowser(userAgent) : null;
    const os = userAgent ? detectOs(userAgent) : null;
    const device = userAgent ? detectDevice(userAgent) : null;

    return {
        ipAddress,
        userAgent,
        device,
        browser,
        os,
        city: headers.get("x-vercel-ip-city") || null,
        country: headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || null,
    };
}