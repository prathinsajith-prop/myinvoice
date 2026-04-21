/**
 * MODERN template — Clean, bold headings, side-by-side org/invoice info,
 * accent left-border on totals, right-aligned amounts, word-wrapped notes.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { InvoicePdfData } from "./types";
import { hexToRgb, money, embedLogo, drawLogoRight, drawFooter, wrapText } from "./helpers";

export async function generateModernInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const L = 48;
    const R = 547;
    const [ar, ag, ab] = hexToRgb(data.accentColor ?? data.primaryColor ?? "#0f766e");

    // ── Top accent strip ─────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 830, width: 595, height: 6, color: rgb(ar, ag, ab) });

    // ── Logo (top-right) ─────────────────────────────────────────────────────
    const logoImg = await embedLogo(pdf, data.organizationLogo);
    if (logoImg) drawLogoRight(page, logoImg, 825, 90, 36, R);

    // ── Org name + TRN (left) ────────────────────────────────────────────────
    page.drawText(data.organizationName.slice(0, 42), { x: L, y: 810, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) });
    let orgY = 794;
    if (data.organizationTrn) {
        page.drawText(`TRN: ${data.organizationTrn}`, { x: L, y: orgY, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
        orgY -= 13;
    }
    if (data.organizationPhone) {
        page.drawText(data.organizationPhone, { x: L, y: orgY, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
    }

    // ── "INVOICE" label + number ─────────────────────────────────────────────
    page.drawText("INVOICE", { x: L, y: 768, size: 22, font: bold, color: rgb(ar, ag, ab) });
    page.drawText(`# ${data.invoiceNumber}`, { x: L, y: 750, size: 11, font, color: rgb(0.35, 0.35, 0.35) });

    // ── Meta grid (right side) ───────────────────────────────────────────────
    const metaX = 360;
    let metaY = 768;
    const metaRow = (label: string, val: string) => {
        page.drawText(label, { x: metaX, y: metaY, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
        page.drawText(val, { x: metaX + 74, y: metaY, size: 8.5, font: bold, color: rgb(0.1, 0.1, 0.1) });
        metaY -= 14;
    };
    metaRow("Issue Date", data.issueDate.toLocaleDateString("en-AE"));
    metaRow("Due Date", data.dueDate.toLocaleDateString("en-AE"));
    metaRow("Currency", data.currency);

    // ── Thin accent divider ───────────────────────────────────────────────────
    let y = 735;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1, color: rgb(ar, ag, ab) });
    y -= 14;

    // ── Bill To ──────────────────────────────────────────────────────────────
    page.drawText("Bill To", { x: L, y, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
    y -= 12;
    page.drawText(data.customerName.slice(0, 50), { x: L, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 13;
    if (data.customerEmail) {
        page.drawText(data.customerEmail, { x: L, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
        y -= 14;
    }
    y -= 10;

    // ── Table header ─────────────────────────────────────────────────────────
    const COL_DESC = L;
    const COL_QTY = 310;
    const COL_UNIT = 362;
    const COL_VAT = 432;
    const COL_TOTAL = R;

    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 14;
    page.drawText("Description", { x: COL_DESC, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("Qty", { x: COL_QTY, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("Unit Price", { x: COL_UNIT, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("VAT", { x: COL_VAT, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    {
        const w = bold.widthOfTextAtSize("Total", 8.5);
        page.drawText("Total", { x: COL_TOTAL - w, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    }
    y -= 6;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 12;

    // ── Line items ─────────────────────────────────────────────────────────────
    for (let i = 0; i < Math.min(data.lineItems.length, 25); i++) {
        const item = data.lineItems[i];
        page.drawText(item.description.slice(0, 56), { x: COL_DESC, y, size: 8.5, font, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(String(Number(item.quantity)), { x: COL_QTY, y, size: 8.5, font });
        page.drawText(Number(item.unitPrice).toFixed(2), { x: COL_UNIT, y, size: 8.5, font });
        page.drawText(Number(item.vatAmount).toFixed(2), { x: COL_VAT, y, size: 8.5, font });
        const totalTxt = Number(item.total).toFixed(2);
        page.drawText(totalTxt, { x: COL_TOTAL - font.widthOfTextAtSize(totalTxt, 8.5), y, size: 8.5, font });
        y -= 14;
        page.drawLine({ start: { x: L, y: y + 1 }, end: { x: R, y: y + 1 }, thickness: 0.3, color: rgb(0.92, 0.92, 0.92) });
        if (y < 180) break;
    }
    y -= 10;

    // ── Totals — accent left border, right-aligned values ───────────────────
    const TX = 340;
    const totalsH = 64;
    page.drawRectangle({ x: TX, y: y - totalsH + 14, width: 4, height: totalsH, color: rgb(ar, ag, ab) });

    const valRow = (label: string, value: string, yRow: number, isBold = false, highlight = false) => {
        const f = isBold ? bold : font;
        const c = highlight ? rgb(ar, ag, ab) : rgb(0.1, 0.1, 0.1);
        const lc = isBold ? rgb(0.25, 0.25, 0.25) : rgb(0.45, 0.45, 0.45);
        const sz = isBold ? 10 : 9;
        page.drawText(label, { x: TX + 10, y: yRow, size: sz, font: f, color: lc });
        const vw = f.widthOfTextAtSize(value, sz);
        page.drawText(value, { x: R - vw, y: yRow, size: sz, font: f, color: c });
    };

    valRow("Subtotal", money(data.subtotal, data.currency), y); y -= 14;
    valRow("VAT", money(data.totalVat, data.currency), y); y -= 14;
    valRow("Total", money(data.total, data.currency), y, true, true); y -= 14;
    valRow("Outstanding", money(data.outstanding, data.currency), y, true, true);

    // ── Notes ────────────────────────────────────────────────────────────────
    if (data.notes && y > 120) {
        y -= 26;
        page.drawText("Notes", { x: L, y, size: 9, font: bold, color: rgb(0.1, 0.1, 0.1) });
        y -= 13;
        const noteLines = wrapText(data.notes, 320, font, 8.5);
        for (const line of noteLines.slice(0, 5)) {
            if (y < 100) break;
            page.drawText(line, { x: L, y, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) });
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
