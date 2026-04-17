/**
 * UAE VAT Calculation Engine
 * Supports inclusive/exclusive VAT, multiple treatments, and line-item calculation.
 */

export type VatTreatment =
    | "STANDARD_RATED"
    | "ZERO_RATED"
    | "EXEMPT"
    | "REVERSE_CHARGE"
    | "OUT_OF_SCOPE";

export interface LineItemInput {
    quantity: number;
    unitPrice: number;
    discount?: number; // percentage 0-100
    vatTreatment?: VatTreatment;
    vatRate?: number; // e.g. 5 for 5%
    vatInclusive?: boolean;
}

export interface LineItemResult extends LineItemInput {
    effectiveVatRate: number;
    subtotal: number; // before VAT, after discount
    vatAmount: number;
    total: number; // subtotal + vatAmount
}

export interface DocumentTotals {
    subtotal: number;
    totalVat: number;
    discount: number;
    total: number;
}

const DEFAULT_VAT_RATE = 5;

/** Effective VAT rate for a given treatment */
export function effectiveRate(treatment: VatTreatment, rate = DEFAULT_VAT_RATE): number {
    if (treatment === "STANDARD_RATED" || treatment === "REVERSE_CHARGE") return rate;
    return 0; // ZERO_RATED, EXEMPT, OUT_OF_SCOPE
}

/** Calculate a single line item */
export function calculateLineItem(item: LineItemInput): LineItemResult {
    const treatment = item.vatTreatment ?? "STANDARD_RATED";
    const vatRate = effectiveRate(treatment, item.vatRate ?? DEFAULT_VAT_RATE);
    const discount = Math.min(Math.max(item.discount ?? 0, 0), 100);

    const grossLine = item.quantity * item.unitPrice;
    const discountAmount = (grossLine * discount) / 100;
    const lineAfterDiscount = grossLine - discountAmount;

    let subtotal: number;
    let vatAmount: number;

    if (item.vatInclusive) {
        // Price includes VAT — extract it
        subtotal = lineAfterDiscount / (1 + vatRate / 100);
        vatAmount = lineAfterDiscount - subtotal;
    } else {
        subtotal = lineAfterDiscount;
        vatAmount = (subtotal * vatRate) / 100;
    }

    return {
        ...item,
        effectiveVatRate: vatRate,
        subtotal: round(subtotal),
        vatAmount: round(vatAmount),
        total: round(subtotal + vatAmount),
    };
}

/** Aggregate totals from an array of calculated line items */
export function calculateDocumentTotals(items: LineItemResult[]): DocumentTotals {
    let subtotal = 0;
    let totalVat = 0;
    let discount = 0;

    for (const item of items) {
        const gross = item.quantity * item.unitPrice;
        const discountAmt = (gross * (item.discount ?? 0)) / 100;
        discount += discountAmt;
        subtotal += item.subtotal;
        totalVat += item.vatAmount;
    }

    return {
        subtotal: round(subtotal),
        totalVat: round(totalVat),
        discount: round(discount),
        total: round(subtotal + totalVat),
    };
}

function round(n: number): number {
    return Math.round(n * 100) / 100;
}
