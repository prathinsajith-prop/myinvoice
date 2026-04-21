/**
 * CLASSIC document template — mirrors classic invoice style for all other docs.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DocumentPdfData } from "./types";
import { hexToRgb, money, embedLogo, drawLogoRight, drawFooter } from "./helpers";

const DOC_LABELS: Record<DocumentPdfData["docType"], string> = {
    BILL: "BILL",
    QUOTATION: "QUOTATION",
    CREDIT_NOTE: "CREDIT NOTE",
    DEBIT_NOTE: "DEBIT NOTE",
    PURCHASE_ORDER: "PURCHASE ORDER",
    DELIVERY_NOTE: "DELIVERY NOTE",
};

export async function generateClassicDocumentPdf(data: DocumentPdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const margin = 48;
    const label = DOC_LABELS[data.docType];
    const [hr, hg, hb] = hexToRgb(data.primaryColor ?? "#1e3a8a");
    const [ar, ag, ab] = hexToRgb(data.accentColor ?? data.primaryColor ?? "#1e3a8a");
    const isDelivery = data.docType === "DELIVERY_NOTE";

    // Header bar
    page.drawRectangle({ x: 0, y: 796, width: 595, height: 46, color: rgb(hr, hg, hb) });
    page.drawText(data.organizationName.slice(0, 40), { x: margin, y: 812, size: 13, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`${label} ${data.docNumber}`, { x: 350, y: 812, size: 10, font: bold, color: rgb(1, 1, 1) });

    const logoImg = await embedLogo(pdf, data.organizationLogo);
    if (logoImg) drawLogoRight(page, logoImg, 826, 80, 30, 547);

    let y = 782;
    if (data.organizationTrn) {
        page.drawText(`TRN: ${data.organizationTrn}`, { x: margin, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 14;
    }

    let dateY = 782;
    page.drawText(`Issue: ${data.issueDate.toLocaleDateString("en-AE")}`, { x: 355, y: dateY, size: 9, font }); dateY -= 13;
    if (data.dueDate) { page.drawText(`Due: ${data.dueDate.toLocaleDateString("en-AE")}`, { x: 355, y: dateY, size: 9, font }); dateY -= 13; }
    if (data.expiryDate) { page.drawText(`Expires: ${data.expiryDate.toLocaleDateString("en-AE")}`, { x: 355, y: dateY, size: 9, font }); dateY -= 13; }
    if (data.reference) { page.drawText(`Ref: ${data.reference}`, { x: 355, y: dateY, size: 9, font, color: rgb(0.4, 0.4, 0.4) }); }

    y -= 8;
    const partyLabel = data.partyType === "customer" ? "BILL TO" : "SUPPLIER";
    page.drawText(partyLabel, { x: margin, y, size: 8, font: bold, color: rgb(ar, ag, ab) });
    y -= 12;
    page.drawText(data.partyName.slice(0, 50), { x: margin, y, size: 10, font: bold }); y -= 13;
    if (data.partyEmail) { page.drawText(data.partyEmail, { x: margin, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) }); y -= 13; }
    if (data.shippingAddress) {
        y -= 4;
        page.drawText(data.docType === "DELIVERY_NOTE" ? "DELIVERY ADDRESS" : "SHIP TO", { x: margin, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
        y -= 12;
        page.drawText(data.shippingAddress.slice(0, 80), { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) }); y -= 13;
    }

    // Table header
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); y -= 2;
    page.drawRectangle({ x: margin - 2, y: y - 4, width: 503, height: 16, color: rgb(hr, hg, hb) });
    if (isDelivery) {
        page.drawText("DESCRIPTION", { x: margin + 2, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
        page.drawText("QTY", { x: 360, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
        page.drawText("UNIT", { x: 402, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
        page.drawText("NOTES", { x: 452, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
    } else {
        page.drawText("DESCRIPTION", { x: margin + 2, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
        page.drawText("QTY", { x: 298, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
        page.drawText("PRICE", { x: 334, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
        page.drawText("DISC%", { x: 390, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
        page.drawText("VAT", { x: 434, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
        page.drawText("TOTAL", { x: 490, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
    }
    y -= 16;

    // Line items
    for (let i = 0; i < Math.min(data.lineItems.length, 22); i++) {
        const item = data.lineItems[i];
        if (i % 2 === 0) page.drawRectangle({ x: margin - 2, y: y - 4, width: 503, height: 14, color: rgb(0.97, 0.97, 0.97) });
        if (isDelivery) {
            page.drawText((item.description ?? "").slice(0, 50), { x: margin + 2, y, size: 8.5, font });
            page.drawText(String(Number(item.quantity)), { x: 360, y, size: 8.5, font });
            page.drawText((item.unitOfMeasure ?? "").slice(0, 8), { x: 402, y, size: 8.5, font });
            if (item.notes) page.drawText(item.notes.slice(0, 20), { x: 452, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
        } else {
            page.drawText((item.description ?? "").slice(0, 48), { x: margin + 2, y, size: 8.5, font });
            page.drawText(String(Number(item.quantity)), { x: 298, y, size: 8.5, font });
            page.drawText(Number(item.unitPrice ?? 0).toFixed(2), { x: 334, y, size: 8.5, font });
            page.drawText(Number(item.discount ?? 0) > 0 ? `${item.discount}%` : "—", { x: 390, y, size: 8.5, font });
            page.drawText(Number(item.vatAmount ?? 0).toFixed(2), { x: 434, y, size: 8.5, font });
            page.drawText(Number(item.total ?? 0).toFixed(2), { x: 490, y, size: 8.5, font });
        }
        y -= 14;
        if (y < 160) break;
    }

    // Totals
    if (!isDelivery && data.subtotal !== undefined) {
        y -= 6;
        page.drawLine({ start: { x: 330, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); y -= 14;
        const boxH = data.totalDiscount ? 72 : 58;
        page.drawRectangle({ x: 330, y: y - boxH + 14, width: 217, height: boxH, color: rgb(ar * 0.92 + 0.08, ag * 0.92 + 0.08, ab * 0.92 + 0.08) });
        page.drawText(`Subtotal: ${money(data.subtotal, data.currency)}`, { x: 338, y, size: 9.5, font }); y -= 14;
        if (data.totalDiscount && data.totalDiscount > 0) {
            page.drawText(`Discount: -${money(data.totalDiscount, data.currency)}`, { x: 338, y, size: 9.5, font, color: rgb(0.1, 0.5, 0.1) }); y -= 14;
        }
        page.drawText(`VAT: ${money(data.totalVat ?? 0, data.currency)}`, { x: 338, y, size: 9.5, font }); y -= 14;
        page.drawText(`Total: ${money(data.total ?? 0, data.currency)}`, { x: 338, y, size: 10.5, font: bold, color: rgb(ar, ag, ab) }); y -= 14;
        if (data.outstanding !== undefined) {
            page.drawText(`Outstanding: ${money(data.outstanding, data.currency)}`, { x: 338, y, size: 10.5, font: bold, color: rgb(ar, ag, ab) });
        }
    }

    // Logistics for delivery note
    if (isDelivery) {
        const logistics = [
            data.trackingNumber && `Tracking: ${data.trackingNumber}`,
            data.carrier && `Carrier: ${data.carrier}`,
            data.driverName && `Driver: ${data.driverName}`,
            data.vehicleNumber && `Vehicle: ${data.vehicleNumber}`,
        ].filter(Boolean) as string[];
        if (logistics.length) {
            y -= 12;
            page.drawText("Logistics", { x: margin, y, size: 9, font: bold }); y -= 12;
            logistics.forEach(info => {
                page.drawText(info, { x: margin, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) }); y -= 12;
            });
        }
    }

    if (data.notes && y > 80) { y -= 14; page.drawText("Notes", { x: margin, y, size: 9, font: bold }); y -= 12; page.drawText(data.notes.slice(0, 280), { x: margin, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) }); }
    if (data.terms && y > 80) { y -= 12; page.drawText("Terms & Conditions", { x: margin, y, size: 9, font: bold }); y -= 12; page.drawText(data.terms.slice(0, 280), { x: margin, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) }); }

    drawFooter(page, font, { phone: data.organizationPhone, website: data.organizationWebsite, address: data.organizationAddress, margin });
    return pdf.save();
}
