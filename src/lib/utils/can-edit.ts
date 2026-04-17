/**
 * Centralized edit-permission checks based on document status.
 * Returns false when the document is in a terminal/locked state.
 */

const NON_EDITABLE_INVOICE = ["VOID", "PAID", "CREDITED"] as const;
const NON_EDITABLE_QUOTATION = ["CONVERTED", "EXPIRED"] as const;
const NON_EDITABLE_BILL = ["PAID", "CANCELLED", "VOID"] as const;
const NON_EDITABLE_EXPENSE = ["APPROVED", "PAID"] as const;
const NON_EDITABLE_CREDIT_NOTE = ["APPLIED", "VOID"] as const;

export type DocType = "invoice" | "quotation" | "bill" | "expense" | "credit-note";

export function canEdit(docType: DocType, status: string): boolean {
    switch (docType) {
        case "invoice":
            return !NON_EDITABLE_INVOICE.includes(status as never);
        case "quotation":
            return !NON_EDITABLE_QUOTATION.includes(status as never);
        case "bill":
            return !NON_EDITABLE_BILL.includes(status as never);
        case "expense":
            return !NON_EDITABLE_EXPENSE.includes(status as never);
        case "credit-note":
            return !NON_EDITABLE_CREDIT_NOTE.includes(status as never);
        default:
            return true;
    }
}
