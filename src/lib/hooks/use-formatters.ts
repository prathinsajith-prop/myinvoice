"use client";

import { useLocale } from "next-intl";
import { formatCurrency, formatAmount } from "@/lib/format";

/**
 * Returns locale-aware formatters bound to the current UI language.
 * Use in client components instead of calling formatCurrency/formatAmount directly.
 *
 * Example:
 *   const { fmt } = useFormatters();
 *   fmt.currency(1234.56)          // "AED 1,234.56" (EN) | "1,234.56 AED" (AR)
 *   fmt.amount(1234.56)            // "1,234.56"
 */
export function useFormatters() {
    const locale = useLocale();

    return {
        fmt: {
            currency: (value: number | string, currency?: string) =>
                formatCurrency(value, currency, locale),
            amount: (value: unknown) =>
                formatAmount(value, locale),
        },
        locale,
    };
}
