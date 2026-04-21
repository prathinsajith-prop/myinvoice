/**
 * MODERN document template — Clean layout, accent side border on totals.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DocumentPdfData } from "./types";
import { hexToRgb, money, embedLogo, drawLogoRight, drawFooter, wrapText } from "./helpers";

const DOC_LABELS: Record<DocumentPdfData["docType"], string> = {
    BILL: "Bill",
    QUOTATION: "Quotation",
    CREDIT_NOTE: "Credit Note",
    DEBIT_NOTE: "Debit Note",
    PURCHASE_ORDER: "Purchase Order",
    DELIVERY_NOTE: "Delivery Note",
};

export async function generateModernDocumentPdf(data: DocumentPdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const margin = 48;
    const label = DOC_LABELS[data.docType];
    const [ar, ag, ab] = hexToRgb(data.accentColor ?? data.primaryColor ?? "#0f766e");
    const isDelivery = data.docType === "DELIVERY_NOTE";

    // Top accent strip
    page.drawRectangle({ x: 0, y: 830, width: 595, height: 6, color: rgb(ar, ag, ab) });

    const logoImg = await embedLogo(pdf, data.organizationLogo);
    if (logoImg) drawLogoRight(page, logoImg, 825, 90, 36, 547);

    page.drawText(data.organizationName.slice(0, 42), { x: margin, y: 810, size: 15, font: bold, color: rgb(0.1, 0.1, 0.1) });
    if (data.organizationTrn) page.drawText(`TRN ${data.organizationTrn}`, { x: margin, y: 793, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });

    page.drawText(label.toUpperCase(), { x: margin, y: 768, size: 20, font: bold, color: rgb(ar, ag, ab) });
    page.drawText(`# ${data.docNumber}`, { x: margin, y: 750, size: 10.5, font, color: rgb(0.35, 0.35, 0.35) });

    const metaX = 360;
    let metaY = 768;
    const meta = (k: string, v: string) => {
        page.drawText(k, { x: metaX, y: metaY, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
        page.drawText(v, { x: metaX + 70, y: metaY, size: 8.5, font: bold }); metaY -= 14;
    };
    meta("Issue Date", data.issueDate.toLocaleDateString("en-AE"));
    if (data.dueDate) meta("Due Date", data.dueDate.toLocaleDateString("en-AE"));
    if (data.expiryDate) meta("Expires", data.expiryDate.toLocaleDateString("en-AE"));
    if (data.reference) meta("Reference", data.reference);

    let y = 735;
    page.drawLine({ start: { x: margin, y }, end: { x: 547, y }, thickness: 0.8, color: rgb(ar, ag, ab) }); y -= 14;

    const pLabel = data.partyType === "customer" ? "Bill To" : "Supplier";
    page.drawText(pLabel, { x: margin, y, size: 8, font, color: rgb(0.55, 0.55, 0.55) }); y -= 12;
    page.drawText(data.partyName.slice(0, 50), { x: margin, y, size: 11, font: bold }); y -= 13;
    if (data.partyEmail) { page.drawText(data.partyEmail, { x: margin, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) }); y -= 13; }
    if (data.shippingAddress) {
        y -= 4;
        page.drawText(data.docType === "DELIVERY_NOTE" ? "Delivery Address" : "Ship To", { x: margin, y, size: 8, font, color: rgb(0.55, 0.55, 0.55) }); y -= 12;
        page.drawText(data.shippingAddress.slice(0, 80), { x: margin, y, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) }); y -= 13;
    }
    y -= 10;

    // Column headers
    page.drawLine({ start: { x: margin, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) }); y -= 14;
    if (isDelivery) {
        page.drawText("Description", { x: margin, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
        page.drawText("Qty", { x: 362, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
        page.drawText("Unit", { x: 402, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
        page.drawText("Notes", { x: 455, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    } else {
        page.drawText("Description", { x: margin, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
        page.drawText("Qty", { x: 298, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
        page.drawText("Price", { x: 334, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
        page.drawText("Disc%", { x: 390, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
        page.drawText("VAT", { x: 432, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
        page.drawText("Total", { x: 492, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    }
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) }); y -= 12;

    for (let i = 0; i < Math.min(data.lineItems.length, 22); i++) {
        const item = data.lineItems[i];
        if (isDelivery) {
            page.drawText((item.description ?? "").slice(0, 50), { x: margin, y, size: 8.5, font });
            page.drawText(String(Number(item.quantity)), { x: 362, y, size: 8.5, font });
            page.drawText((item.unitOfMeasure ?? "").slice(0, 8), { x: 402, y, size: 8.5, font });
            if (item.notes) page.drawText(item.notes.slice(0, 20), { x: 455, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
        } else {
            page.drawText((item.description ?? "").slice(0, 48), { x: margin, y, size: 8.5, font });
            page.drawText(String(Number(item.quantity)), { x: 298, y, size: 8.5, font });
            page.drawText(Number(item.unitPrice ?? 0).toFixed(2), { x: 334, y, size: 8.5, font });
            page.drawText(Number(item.discount ?? 0) > 0 ? `${item.discount}%` : "—", { x: 390, y, size: 8.5, font });
            page.drawText(Number(item.vatAmount ?? 0).toFixed(2), { x: 432, y, size: 8.5, font });
            {
                const totalTxt = Number(item.total ?? 0).toFixed(2);
                page.drawText(totalTxt, { x: 547 - font.widthOfTextAtSize(totalTxt, 8.5), y, size: 8.5, font });
            }
        }
        y -= 14;
        page.drawLine({ start: { x: margin, y: y + 1 }, end: { x: 547, y: y + 1 }, thickness: 0.3, color: rgb(0.92, 0.92, 0.92) });
        if (y < 160) break;
    }

    if (!isDelivery && data.subtotal !== undefined) {
        y -= 10;
        const TX = 342; const VX = 547;
        const totH = data.totalDiscount && data.totalDiscount > 0 ? 76 : 62;
        page.drawRectangle({ x: 330, y: y - totH + 14, width: 4, height: totH, color: rgb(ar, ag, ab) });
        const tRow = (lbl: string, val: string, sz: number, f: typeof font, c = rgb(0.1, 0.1, 0.1)) => {
            page.drawText(lbl, { x: TX, y, size: sz, font: f, color: c });
            page.drawText(val, { x: VX - f.widthOfTextAtSize(val, sz), y, size: sz, font: f, color: c }); y -= 14;
        };
        tRow("Subtotal", money(data.subtotal, data.currency), 9, font, rgb(0.45, 0.45, 0.45));
        if (data.totalDiscount && data.totalDiscount > 0) tRow("Discount", `-${money(data.totalDiscount, data.currency)}`, 9, font, rgb(0.1, 0.5, 0.1));
        tRow("VAT", money(data.totalVat ?? 0, data.currency), 9, font, rgb(0.45, 0.45, 0.45));
        tRow("Total", money(data.total ?? 0, data.currency), 10.5, bold, rgb(ar, ag, ab));
        if (data.outstanding !== undefined) tRow("Outstanding", money(data.outstanding, data.currency), 10.5, bold, rgb(ar, ag, ab));
    }

    if (isDelivery) {
        const logistics = [data.trackingNumber && `Tracking: ${data.trackingNumber}`, data.carrier && `Carrier: ${data.carrier}`, data.driverName && `Driver: ${data.driverName}`, data.vehicleNumber && `Vehicle: ${data.vehicleNumber}`].filter(Boolean) as string[];
        if (logistics.length) { y -= 14; page.drawText("Logistics", { x: margin, y, size: 9, font: bold }); y -= 12; logistics.forEach(i => { page.drawText(i, { x: margin, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) }); y -= 12; }); }
    }

    if (data.notes && y > 80) {
        y -= 14; page.drawText("Notes", { x: margin, y, size: 9, font: bold }); y -= 12;
        for (const line of wrapText(data.notes, 460, font, 8.5).slice(0, 5)) { if (y < 70) break; page.drawText(line, { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) }); y -= 12; }
    }
    if (data.terms && y > 80) {
        y -= 10; page.drawText("Terms & Conditions", { x: margin, y, size: 9, font: bold }); y -= 12;
        for (const line of wrapText(data.terms, 460, font, 8.5).slice(0, 5)) { if (y < 70) break; page.drawText(line, { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) }); y -= 12; }
    }

    drawFooter(page, font, { phone: data.organizationPhone, website: data.organizationWebsite, address: data.organizationAddress, margin });
    return pdf.save();
}
