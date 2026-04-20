// Map a locale string to an Intl-compatible tag that always uses Western digits
function intlLocale(locale = "en"): string {
    return locale.startsWith("ar") ? "ar-AE-u-nu-latn" : "en-AE";
}

export function formatCurrency(value: number | string, currency = "AED", locale = "en"): string {
    const n = Number(value);
    const formatted = (isNaN(n) ? 0 : n).toLocaleString(intlLocale(locale), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    // Arabic convention: amount followed by currency code
    return locale.startsWith("ar") ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

export function formatAmount(value: unknown, locale = "en"): string {
    const n = Number(value);
    if (isNaN(n)) return "0.00";
    return n.toLocaleString(intlLocale(locale), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Format a date using the given format pattern.
 * Supports: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD MMM YYYY
 */
export function formatDate(value: string | Date, pattern?: string): string {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);

    if (!pattern) {
        return d.toLocaleDateString("en-AE");
    }

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear());
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mmm = monthNames[d.getMonth()];

    switch (pattern) {
        case "DD/MM/YYYY": return `${day}/${month}/${year}`;
        case "MM/DD/YYYY": return `${month}/${day}/${year}`;
        case "YYYY-MM-DD": return `${year}-${month}-${day}`;
        case "DD-MM-YYYY": return `${day}-${month}-${year}`;
        case "DD MMM YYYY": return `${day} ${mmm} ${year}`;
        default: return d.toLocaleDateString("en-AE");
    }
}
