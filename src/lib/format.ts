const LOCALE = "en-AE";

export function formatCurrency(value: number | string, currency = "AED"): string {
    return `${currency} ${Number(value).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatAmount(value: unknown): string {
    return Number(value).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(value: string | Date): string {
    return new Date(value).toLocaleDateString(LOCALE);
}
