/**
 * MINIMAL document template — No fills, clean lines, right-aligned totals.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DocumentPdfData } from "./types";
import { hexToRgb, money, embedLogo, drawLogoRight, drawFooter } from "./helpers";

const DOC_LABELS: Record<DocumentPdfData["docType"], string> = {
    BILL: "Bill",
    QUOTATION: "Quotation",
    CREDIT_NOTE: "Credit Note",
    DEBIT_NOTE: "Debit Note",
    PURCHASE_ORDER: "Purchase Order",
    DELIVERY_NOTE: "Delivery Note",
};

export async function generateMinimalDocumentPdf(data: DocumentPdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const margin = 56;
    const label = DOC_LABELS[data.docType];
    const [ar, ag, ab] = hexToRgb(data.accentColor ?? data.primaryColor ?? "#111827");
    const isDelivery = data.docType === "DELIVERY_NOTE";

    const logoImg = await embedLogo(pdf, data.organizationLogo);
    if (logoImg) drawLogoRight(page, logoImg, 822, 90, 34, 539);

    page.drawText(data.organizationName.slice(0, 42), { x: margin, y: 808, size: 15, font: bold, color: rgb(ar, ag, ab) });
    let orgY = 793;
    if (data.organizationTrn) { page.drawText(`TRN: ${data.organizationTrn}`, { x: margin, y: orgY, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) }); orgY -= 12; }
    if (data.organizationPhone) page.drawText(data.organizationPhone, { x: margin, y: orgY, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) });

    page.drawText(label, { x: 380, y: 808, size: 11, font: bold, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`#${data.docNumber}`, { x: 380, y: 793, size: 9.5, font, color: rgb(0.35, 0.35, 0.35) });
    page.drawText(data.issueDate.toLocaleDateString("en-AE"), { x: 380, y: 779, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
    if (data.dueDate) page.drawText(`Due ${data.dueDate.toLocaleDateString("en-AE")}`, { x: 380, y: 766, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
    if (data.expiryDate) page.drawText(`Exp ${data.expiryDate.toLocaleDateString("en-AE")}`, { x: 380, y: 753, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });

    let y = 752;
    page.drawLine({ start: { x: margin, y }, end: { x: 539, y }, thickness: 1, color: rgb(ar, ag, ab) }); y -= 14;

    const pLabel = data.partyType === "customer" ? "Bill to" : "Supplier";
    page.drawText(pLabel, { x: margin, y, size: 7.5, font, color: rgb(0.6, 0.6, 0.6) }); y -= 12;
    page.drawText(data.partyName.slice(0, 50), { x: margin, y, size: 10, font: bold }); y -= 13;
    if (data.partyEmail) { page.drawText(data.partyEmail, { x: margin, y, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) }); y -= 13; }
    if (data.shippingAddress) { y -= 4; page.drawText(data.shippingAddress.slice(0, 80), { x: margin, y, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) }); y -= 13; }
    y -= 12;

    // Column headers
    if (isDelivery) {
        page.drawText("Description", { x: margin, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
        page.drawText("Qty", { x: 362, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
        page.drawText("Unit", { x: 402, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    } else {
        page.drawText("Description", { x: margin, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
        page.drawText("Qty", { x: 298, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
        page.drawText("Price", { x: 334, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
        page.drawText("Disc%", { x: 390, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
        page.drawText("VAT", { x: 432, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
        page.drawText("Total", { x: 492, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    }
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: 539, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) }); y -= 12;

    for (let i = 0; i < Math.min(data.lineItems.length, 22); i++) {
        const item = data.lineItems[i];
        if (isDelivery) {
            page.drawText((item.description ?? "").slice(0, 56), { x: margin, y, size: 8.5, font });
            page.drawText(String(Number(item.quantity)), { x: 362, y, size: 8.5, font });
            page.drawText((item.unitOfMeasure ?? "").slice(0, 8), { x: 402, y, size: 8.5, font });
        } else {
            page.drawText((item.description ?? "").slice(0, 48), { x: margin, y, size: 8.5, font });
            page.drawText(String(Number(item.quantity)), { x: 298, y, size: 8.5, font });
            page.drawText(Number(item.unitPrice ?? 0).toFixed(2), { x: 334, y, size: 8.5, font });
            page.drawText(Number(item.discount ?? 0) > 0 ? `${item.discount}%` : "—", { x: 390, y, size: 8.5, font });
            page.drawText(Number(item.vatAmount ?? 0).toFixed(2), { x: 432, y, size: 8.5, font });
            page.drawText(Number(item.total ?? 0).toFixed(2), { x: 492, y, size: 8.5, font });
        }
        y -= 14;
        if (y < 160) break;
    }

    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: 539, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) }); y -= 14;

    if (!isDelivery && data.subtotal !== undefined) {
        const tx = 380;
        if (data.totalDiscount && data.totalDiscount > 0) { page.drawText("Discount", { x: tx, y, size: 9, font, color: rgb(0.1, 0.5, 0.1) }); page.drawText(`-${money(data.totalDiscount, data.currency)}`, { x: 460, y, size: 9, font, color: rgb(0.1, 0.5, 0.1) }); y -= 13; }
        page.drawText("Subtotal", { x: tx, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
        page.drawText(money(data.subtotal, data.currency), { x: 460, y, size: 9, font }); y -= 13;
        page.drawText("VAT", { x: tx, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
        page.drawText(money(data.totalVat ?? 0, data.currency), { x: 460, y, size: 9, font }); y -= 6;
        page.drawLine({ start: { x: tx, y }, end: { x: 539, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) }); y -= 11;
        page.drawText("Total", { x: tx, y, size: 11, font: bold, color: rgb(ar, ag, ab) });
        page.drawText(money(data.total ?? 0, data.currency), { x: 460, y, size: 11, font: bold, color: rgb(ar, ag, ab) }); y -= 14;
        if (data.outstanding !== undefined) {
            page.drawText("Outstanding", { x: tx, y, size: 9.5, font: bold, color: rgb(ar, ag, ab) });
            page.drawText(money(data.outstanding, data.currency), { x: 460, y, size: 9.5, font: bold, color: rgb(ar, ag, ab) });
        }
    }

    if (isDelivery) {
        const logistics = [data.trackingNumber && `Tracking: ${data.trackingNumber}`, data.carrier && `Carrier: ${data.carrier}`, data.driverName && `Driver: ${data.driverName}`, data.vehicleNumber && `Vehicle: ${data.vehicleNumber}`].filter(Boolean) as string[];
        if (logistics.length) { y -= 14; page.drawText("Logistics", { x: margin, y, size: 8.5, font: bold }); y -= 12; logistics.forEach(i => { page.drawText(i, { x: margin, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) }); y -= 12; }); }
    }

    if (data.notes && y > 80) { y -= 24; page.drawText("Notes", { x: margin, y, size: 8.5, font: bold }); y -= 12; page.drawText(data.notes.slice(0, 280), { x: margin, y, size: 8, font, color: rgb(0.45, 0.45, 0.45) }); }
    if (data.terms && y > 80) { y -= 12; page.drawText("Terms & Conditions", { x: margin, y, size: 8.5, font: bold }); y -= 12; page.drawText(data.terms.slice(0, 280), { x: margin, y, size: 8, font, color: rgb(0.45, 0.45, 0.45) }); }

    drawFooter(page, font, { phone: data.organizationPhone, website: data.organizationWebsite, address: data.organizationAddress, margin });
    return pdf.save();
}
