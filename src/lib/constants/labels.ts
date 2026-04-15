/** Human-readable labels for enum values used across the app */

export const VAT_TREATMENT_LABELS: Record<string, string> = {
    STANDARD_RATED: "Standard Rated (5%)",
    ZERO_RATED: "Zero Rated (0%)",
    EXEMPT: "Exempt",
    OUT_OF_SCOPE: "Out of Scope",
    REVERSE_CHARGE: "Reverse Charge (5%)",
} as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Cash",
    BANK_TRANSFER: "Bank Transfer",
    CHEQUE: "Cheque",
    CARD: "Card",
    STRIPE: "Stripe",
    PAYBY: "PayBy",
    TABBY: "Tabby",
    TAMARA: "Tamara",
    OTHER: "Other",
} as const;

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
    BUSINESS: "Business",
    INDIVIDUAL: "Individual",
} as const;
