/**
 * MINIMAL template — Lightweight, no fills, clean typography,
 * single thin-line separators, right-aligned amounts, word-wrapped notes.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { InvoicePdfData } from "./types";
import { hexToRgb, money, embedLogo, drawLogoRight, drawFooter, wrapText } from "./helpers";

export async function generateMinimalInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const L = 56;
    const R = 539;
    const [ar, ag, ab] = hexToRgb(data.accentColor ?? data.primaryColor ?? "#111827");

    // ── Logo (top-right, no background) ──────────────────────────────────────
    const logoImg = await embedLogo(pdf, data.organizationLogo);
    if (logoImg) drawLogoRight(page, logoImg, 822, 90, 34, R);

    // ── Org block ────────────────────────────────────────────────────────────
    page.drawText(data.organizationName.slice(0, 42), { x: L, y: 808, size: 15, font: bold, color: rgb(ar, ag, ab) });
    let orgY = 793;
    if (data.organizationTrn) {
        page.drawText(`TRN: ${data.organizationTrn}`, { x: L, y: orgY, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) });
        orgY -= 12;
    }
    if (data.organizationPhone) {
        page.drawText(data.organizationPhone, { x: L, y: orgY, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) });
    }

    // ── Invoice meta (right column) ──────────────────────────────────────────
    page.drawText("Invoice", { x: 380, y: 808, size: 11, font: bold, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`#${data.invoiceNumber}`, { x: 380, y: 793, size: 9.5, font, color: rgb(0.35, 0.35, 0.35) });
    page.drawText(data.issueDate.toLocaleDateString("en-AE"), { x: 380, y: 779, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
    page.drawText(`Due ${data.dueDate.toLocaleDateString("en-AE")}`, { x: 380, y: 766, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
    page.drawText(data.currency, { x: 380, y: 753, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });

    // ── Full-width rule ───────────────────────────────────────────────────────
    let y = 740;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1, color: rgb(ar, ag, ab) });
    y -= 14;

    // ── Bill to ───────────────────────────────────────────────────────────────
    page.drawText("Bill to", { x: L, y, size: 7.5, font, color: rgb(0.6, 0.6, 0.6) });
    y -= 12;
    page.drawText(data.customerName.slice(0, 50), { x: L, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 13;
    if (data.customerEmail) {
        page.drawText(data.customerEmail, { x: L, y, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) });
        y -= 13;
    }
    y -= 12;

    // ── Column headers ────────────────────────────────────────────────────────
    const COL_DESC = L;
    const COL_QTY = 310;
    const COL_UNIT = 358;
    const COL_VAT = 430;
    const COL_TOTAL = R;

    page.drawText("Description", { x: COL_DESC, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("Qty", { x: COL_QTY, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("Unit Price", { x: COL_UNIT, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("VAT", { x: COL_VAT, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    {
        const w = bold.widthOfTextAtSize("Total", 8);
        page.drawText("Total", { x: COL_TOTAL - w, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    }
    y -= 6;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 12;

    // ── Line items ────────────────────────────────────────────────────────────
    for (let i = 0; i < Math.min(data.lineItems.length, 25); i++) {
        const item = data.lineItems[i];
        page.drawText(item.description.slice(0, 58), { x: COL_DESC, y, size: 8.5, font, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(String(Number(item.quantity)), { x: COL_QTY, y, size: 8.5, font });
        page.drawText(Number(item.unitPrice).toFixed(2), { x: COL_UNIT, y, size: 8.5, font });
        page.drawText(Number(item.vatAmount).toFixed(2), { x: COL_VAT, y, size: 8.5, font });
        const totalTxt = Number(item.total).toFixed(2);
        page.drawText(totalTxt, { x: COL_TOTAL - font.widthOfTextAtSize(totalTxt, 8.5), y, size: 8.5, font });
        y -= 14;
        if (y < 180) break;
    }

    y -= 4;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 14;

    // ── Totals (right-aligned, no box) ────────────────────────────────────────
    const TX = 370;
    const valRow = (label: string, value: string, yRow: number, isBold = false, isAccent = false) => {
        const f = isBold ? bold : font;
        const sz = isBold ? 10.5 : 9;
        const vc = isAccent ? rgb(ar, ag, ab) : rgb(0.1, 0.1, 0.1);
        page.drawText(label, { x: TX, y: yRow, size: sz, font: f, color: rgb(0.45, 0.45, 0.45) });
        const vw = f.widthOfTextAtSize(value, sz);
        page.drawText(value, { x: R - vw, y: yRow, size: sz, font: f, color: vc });
    };

    valRow("Subtotal", money(data.subtotal, data.currency), y); y -= 13;
    valRow("VAT", money(data.totalVat, data.currency), y); y -= 6;
    page.drawLine({ start: { x: TX, y }, end: { x: R, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 11;
    valRow("Total", money(data.total, data.currency), y, true, true); y -= 14;
    valRow("Outstanding", money(data.outstanding, data.currency), y, true, true);

    // ── Notes ────────────────────────────────────────────────────────────────
    if (data.notes && y > 120) {
        y -= 24;
        page.drawText("Notes", { x: L, y, size: 8.5, font: bold, color: rgb(0.1, 0.1, 0.1) });
        y -= 12;
        const noteLines = wrapText(data.notes, 330, font, 8);
        for (const line of noteLines.slice(0, 5)) {
            if (y < 100) break;
            page.drawText(line, { x: L, y, size: 8, font, color: rgb(0.45, 0.45, 0.45) });
            y -= 12;
        }
    }

    // ── FTA QR ───────────────────────────────────────────────────────────────
    if (data.qrCodeData) {
        try {
            const qrDataUrl = await QRCode.toDataURL(data.qrCodeData, { width: 140, margin: 1 });
            const qrImg = await pdf.embedPng(Buffer.from(qrDataUrl.split(",")[1], "base64"));
            page.drawImage(qrImg, { x: L, y: 58, width: 58, height: 58 });
            page.drawText("FTA Compliant", { x: L, y: 52, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
        } catch { /* ignore */ }
    }

    drawFooter(page, font, {
        phone: data.organizationPhone,
        website: data.organizationWebsite,
        address: data.organizationAddress,
        margin: L,
    });

    return pdf.save();
}
