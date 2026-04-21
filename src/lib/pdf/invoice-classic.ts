/**
 * CLASSIC template — Professional corporate style inspired by reference invoice.
 * Clean header, org info top-left, invoice meta top-right, full-width table, right-aligned totals.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { InvoicePdfData } from "./types";
import { hexToRgb, money, embedLogo, drawLogoRight, drawFooter, wrapText } from "./helpers";

/** Right-align text so it ends at xRight. */
function drawRight(page: ReturnType<PDFDocument["addPage"]>, text: string, xRight: number, y: number, opts: Parameters<typeof page.drawText>[1]) {
    const w = (opts?.font as { widthOfTextAtSize?: (t: string, s: number) => number })?.widthOfTextAtSize?.(text, opts?.size ?? 9) ?? 0;
    page.drawText(text, { ...opts, x: xRight - w, y });
}

export async function generateClassicInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const L = 48;   // left margin
    const R = 547;  // right edge
    const W = R - L;
    const [hr, hg, hb] = hexToRgb(data.primaryColor ?? "#1e3a8a");
    const [ar, ag, ab] = hexToRgb(data.accentColor ?? data.primaryColor ?? "#1e3a8a");

    // ── Header bar ───────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 796, width: 595, height: 46, color: rgb(hr, hg, hb) });
    page.drawText(data.organizationName.slice(0, 40), { x: L, y: 813, size: 14, font: bold, color: rgb(1, 1, 1) });
    page.drawText("INVOICE", { x: 370, y: 820, size: 10, font: bold, color: rgb(1, 1, 1) });
    page.drawText(data.invoiceNumber, { x: 370, y: 808, size: 12, font: bold, color: rgb(1, 1, 1) });

    // Logo (top-right of header)
    const logoImg = await embedLogo(pdf, data.organizationLogo);
    if (logoImg) drawLogoRight(page, logoImg, 832, 90, 36, R);

    // ── Org info (left) + Invoice meta (right) ───────────────────────────────
    let orgY = 784;
    if (data.organizationTrn) {
        page.drawText(`TRN: ${data.organizationTrn}`, { x: L, y: orgY, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
        orgY -= 13;
    }
    if (data.organizationAddress) {
        const addrLines = data.organizationAddress.split(",").map(s => s.trim()).filter(Boolean);
        for (const line of addrLines.slice(0, 2)) {
            page.drawText(line, { x: L, y: orgY, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) });
            orgY -= 12;
        }
    }
    if (data.organizationPhone) {
        page.drawText(`Tel: ${data.organizationPhone}`, { x: L, y: orgY, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) });
        orgY -= 12;
    }

    // Meta block — right column
    const mx = 360;
    const metaLabel = (label: string, value: string, y: number) => {
        page.drawText(label, { x: mx, y, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
        page.drawText(value, { x: mx + 72, y, size: 8.5, font: bold, color: rgb(0.1, 0.1, 0.1) });
    };
    metaLabel("Issue Date:", data.issueDate.toLocaleDateString("en-AE"), 784);
    metaLabel("Due Date:", data.dueDate.toLocaleDateString("en-AE"), 771);
    metaLabel("Currency:", data.currency, 758);

    // ── Divider ──────────────────────────────────────────────────────────────
    let y = 742;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 13;

    // ── Bill To ──────────────────────────────────────────────────────────────
    page.drawText("BILL TO", { x: L, y, size: 7.5, font: bold, color: rgb(ar, ag, ab) });
    y -= 12;
    page.drawText(data.customerName.slice(0, 55), { x: L, y, size: 10.5, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 13;
    if (data.customerEmail) {
        page.drawText(data.customerEmail, { x: L, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
        y -= 14;
    }

    y -= 6;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 14;

    // ── Table header row ──────────────────────────────────────────────────────
    // Column x positions
    const COL_DESC = L;
    const COL_QTY = 310;
    const COL_UNIT = 365;
    const COL_VAT = 435;
    const COL_TOTAL = R;

    page.drawRectangle({ x: L - 2, y: y - 4, width: W + 4, height: 16, color: rgb(hr, hg, hb) });
    page.drawText("DESCRIPTION", { x: COL_DESC + 2, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText("QTY", { x: COL_QTY, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText("UNIT PRICE", { x: COL_UNIT, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText("VAT", { x: COL_VAT, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1) });
    drawRight(page, "TOTAL", COL_TOTAL, y + 2, { size: 8, font: bold, color: rgb(1, 1, 1) });
    y -= 16;

    // ── Line items ─────────────────────────────────────────────────────────────
    for (let i = 0; i < Math.min(data.lineItems.length, 25); i++) {
        const item = data.lineItems[i];
        if (i % 2 === 0) {
            page.drawRectangle({ x: L - 2, y: y - 4, width: W + 4, height: 14, color: rgb(0.96, 0.96, 0.98) });
        }
        page.drawText(item.description.slice(0, 56), { x: COL_DESC + 2, y, size: 8.5, font, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(String(Number(item.quantity)), { x: COL_QTY, y, size: 8.5, font });
        page.drawText(Number(item.unitPrice).toFixed(2), { x: COL_UNIT, y, size: 8.5, font });
        page.drawText(Number(item.vatAmount).toFixed(2), { x: COL_VAT, y, size: 8.5, font });
        drawRight(page, Number(item.total).toFixed(2), COL_TOTAL, y, { size: 8.5, font });
        y -= 14;
        if (y < 180) break;
    }

    y -= 4;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 18;

    // ── Totals block (right-aligned, clean on white) ───────────────────────────
    const TX = 360; // label start
    const VX = R;   // value right edge

    const totalRow = (label: string, value: string, yRow: number, isBold = false, highlight = false) => {
        const f = isBold ? bold : font;
        const c = highlight ? rgb(ar, ag, ab) : rgb(0.1, 0.1, 0.1);
        page.drawText(label, { x: TX, y: yRow, size: isBold ? 10 : 9, font: f, color: rgb(0.35, 0.35, 0.35) });
        drawRight(page, value, VX, yRow, { size: isBold ? 10 : 9, font: f, color: c });
    };

    totalRow("Subtotal", money(data.subtotal, data.currency), y); y -= 14;
    totalRow("VAT", money(data.totalVat, data.currency), y); y -= 8;
    page.drawLine({ start: { x: TX, y }, end: { x: R, y }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
    y -= 10;
    totalRow("TOTAL", money(data.total, data.currency), y, true, true); y -= 14;
    totalRow("Outstanding", money(data.outstanding, data.currency), y, true, true);

    // ── Notes ────────────────────────────────────────────────────────────────
    if (data.notes && y > 120) {
        y -= 26;
        page.drawText("Notes", { x: L, y, size: 9, font: bold, color: rgb(0.1, 0.1, 0.1) });
        y -= 13;
        const noteLines = wrapText(data.notes, 320, font, 8.5);
        for (const line of noteLines.slice(0, 5)) {
            if (y < 100) break;
            page.drawText(line, { x: L, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) });
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
