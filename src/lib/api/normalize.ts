/**
 * Normalizes incoming request bodies so frontend field names / values
 * match the API Zod schemas.  Called before safeParse() in every document route.
 */

const VAT_TREATMENT_MAP: Record<string, string> = {
    STANDARD: "STANDARD_RATED",
    "": "STANDARD_RATED",
};

export function normalizeDocumentBody(
    body: Record<string, unknown>,
): Record<string, unknown> {
    const out = { ...body };

    // termsAndConditions → terms
    if (out.termsAndConditions !== undefined && out.terms === undefined) {
        out.terms = out.termsAndConditions;
        delete out.termsAndConditions;
    }

    // billDate → issueDate
    if (out.billDate !== undefined && out.issueDate === undefined) {
        out.issueDate = out.billDate;
        delete out.billDate;
    }

    // supplierReference → supplierInvoiceNumber
    if (
        out.supplierReference !== undefined &&
        out.supplierInvoiceNumber === undefined
    ) {
        out.supplierInvoiceNumber = out.supplierReference;
        delete out.supplierReference;
    }

    // Normalize line items
    if (Array.isArray(out.lineItems)) {
        out.lineItems = (out.lineItems as Record<string, unknown>[]).map(
            (item) => {
                const li = { ...item };

                // discountPercent → discount
                if (li.discountPercent !== undefined && li.discount === undefined) {
                    li.discount = li.discountPercent;
                    delete li.discountPercent;
                }

                // Map short VAT names to full enum values
                if (typeof li.vatTreatment === "string") {
                    li.vatTreatment =
                        VAT_TREATMENT_MAP[li.vatTreatment] ?? li.vatTreatment;
                }

                return li;
            },
        );
    }

    return out;
}
