/**
 * Template resolver — picks the correct generation function based on PdfTemplate value.
 * All PDF generation should go through these functions.
 */
import type { InvoicePdfData, DocumentPdfData } from "./types";
import { generateClassicInvoicePdf } from "./invoice-classic";
import { generateModernInvoicePdf } from "./invoice-modern";
import { generateMinimalInvoicePdf } from "./invoice-minimal";
import { generateClassicDocumentPdf } from "./document-classic";
import { generateModernDocumentPdf } from "./document-modern";
import { generateMinimalDocumentPdf } from "./document-minimal";

export type PdfTemplateValue = "CLASSIC" | "MODERN" | "MINIMAL";

/**
 * Generate an invoice PDF using the org's chosen template.
 */
export async function generateInvoicePdf(
    data: InvoicePdfData,
    template: PdfTemplateValue = "CLASSIC"
): Promise<Uint8Array> {
    switch (template) {
        case "MODERN":
            return generateModernInvoicePdf(data);
        case "MINIMAL":
            return generateMinimalInvoicePdf(data);
        case "CLASSIC":
        default:
            return generateClassicInvoicePdf(data);
    }
}

/**
 * Generate a generic document PDF (bill, quote, credit note, etc.)
 * using the org's chosen template.
 */
export async function generateDocumentPdf(
    data: DocumentPdfData,
    template: PdfTemplateValue = "CLASSIC"
): Promise<Uint8Array> {
    switch (template) {
        case "MODERN":
            return generateModernDocumentPdf(data);
        case "MINIMAL":
            return generateMinimalDocumentPdf(data);
        case "CLASSIC":
        default:
            return generateClassicDocumentPdf(data);
    }
}
