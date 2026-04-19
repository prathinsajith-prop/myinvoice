/**
 * Shared client-side document calculation utilities.
 * Used by invoice-sheet, bill-sheet, quotation-sheet, purchase-order-sheet.
 *
 * VAT logic is aligned with src/lib/services/vat.ts (server-side source of truth).
 * REVERSE_CHARGE = 5% per UAE FTA rules (buyer accounts for VAT at standard rate).
 */

import { z } from "zod";

// ─── VAT ─────────────────────────────────────────────────────────────────────

export const VAT_RATES: Record<string, number> = {
    STANDARD_RATED: 0.05,
    REVERSE_CHARGE: 0.05, // UAE FTA: recipient accounts for 5%
    EXEMPT: 0,
    ZERO_RATED: 0,
    OUT_OF_SCOPE: 0,
};

// ─── Line item schema (client-side) ─────────────────────────────────────────

export const lineItemSchema = z.object({
    description: z.string().min(1, "Description required"),
    quantity: z.coerce.number().positive("Must be > 0"),
    unitPrice: z.coerce.number().min(0),
    discountPercent: z.coerce.number().min(0).max(100).default(0),
    vatTreatment: z.string().default("STANDARD_RATED"),
    productId: z.string().optional(),
});

export type LineItemFormValue = z.infer<typeof lineItemSchema>;

export const DEFAULT_LINE_ITEM: LineItemFormValue = {
    description: "",
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    vatTreatment: "STANDARD_RATED",
};

// ─── Calculation ─────────────────────────────────────────────────────────────

export interface LineCalcResult {
    subtotal: number;
    discountAmt: number;
    taxable: number;
    vatAmt: number;
    lineTotal: number;
}

export function calcLine(
    qty: number,
    price: number,
    disc: number,
    vat: string,
): LineCalcResult {
    const subtotal = qty * price;
    const discountAmt = subtotal * (disc / 100);
    const taxable = subtotal - discountAmt;
    const vatAmt = taxable * (VAT_RATES[vat] ?? 0.05);
    return { subtotal, discountAmt, taxable, vatAmt, lineTotal: taxable + vatAmt };
}

export interface DocumentTotals {
    subtotal: number;
    discount: number;
    taxable: number;
    vat: number;
    total: number;
}

export function reduceTotals(items: LineItemFormValue[]): DocumentTotals {
    return items.reduce<DocumentTotals>(
        (acc, item) => {
            const r = calcLine(
                Number(item.quantity) || 0,
                Number(item.unitPrice) || 0,
                Number(item.discountPercent) || 0,
                item.vatTreatment ?? "STANDARD_RATED",
            );
            return {
                subtotal: acc.subtotal + r.subtotal,
                discount: acc.discount + r.discountAmt,
                taxable: acc.taxable + r.taxable,
                vat: acc.vat + r.vatAmt,
                total: acc.total + r.lineTotal,
            };
        },
        { subtotal: 0, discount: 0, taxable: 0, vat: 0, total: 0 },
    );
}

// ─── Product auto-fill helper ─────────────────────────────────────────────────

export interface ProductOption {
    id: string;
    name: string;
    unitPrice: number;
    vatTreatment: string;
}

export function applyProduct<T extends Record<string, unknown>>(
    setValue: (field: string, value: unknown) => void,
    index: number,
    productId: string,
    products: ProductOption[],
): void {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setValue(`lineItems.${index}.productId`, productId);
    setValue(`lineItems.${index}.description`, p.name);
    setValue(`lineItems.${index}.unitPrice`, p.unitPrice);
    setValue(`lineItems.${index}.vatTreatment`, p.vatTreatment ?? "STANDARD_RATED");
}

// ─── Numeric input key guard ──────────────────────────────────────────────────

export function numericKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (!/[\d.]/.test(e.key) && !allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
    }
}
