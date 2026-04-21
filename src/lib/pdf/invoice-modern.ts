/**
 * MODERN template — Clean, bold headings, side-by-side org/invoice info,
 * accent left-border on totals, rounded pill status badge.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { InvoicePdfData } from "./types";
import { hexToRgb, money, embedLogo, drawLogoRight, drawFooter } from "./helpers";

export async function generateModernInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 48;
    const [ar, ag, ab] = hexToRgb(data.accentColor ?? data.primaryColor ?? "#0f766e");

    // ── Top accent strip ─────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 830, width: 595, height: 6, color: rgb(ar, ag, ab) });

    // ── Logo (top-right) ─────────────────────────────────────────────────────
    const logoImg = await embedLogo(pdf, data.organizationLogo);
    if (logoImg) drawLogoRight(page, logoImg, 825, 90, 36, 547);

    // ── Org name + TRN (left) ────────────────────────────────────────────────
    page.drawText(data.organizationName.slice(0, 42), { x: margin, y: 810, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) });
    if (data.organizationTrn) {
        page.drawText(`TRN ${data.organizationTrn}`, { x: margin, y: 793, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
    }

    // ── "INVOICE" label + number ─────────────────────────────────────────────
    page.drawText("INVOICE", { x: margin, y: 768, size: 22, font: bold, color: rgb(ar, ag, ab) });
    page.drawText(`# ${data.invoiceNumber}`, { x: margin, y: 750, size: 11, font, color: rgb(0.35, 0.35, 0.35) });

    // ── Meta grid (right side) ───────────────────────────────────────────────
    const metaX = 360;
    let metaY = 768;
    const label = (txt: string, val: string) => {
        page.drawText(txt, { x: metaX, y: metaY, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
        page.drawText(val, { x: metaX + 70, y: metaY, size: 8.5, font: bold, color: rgb(0.1, 0.1, 0.1) });
        metaY -= 14;
    };
    label("Issue Date", data.issueDate.toLocaleDateString("en-AE"));
    label("Due Date", data.dueDate.toLocaleDateString("en-AE"));
    label("Currency", data.currency);

    // ── Thin divider ─────────────────────────────────────────────────────────
    let y = 735;
    page.drawLine({ start: { x: margin, y }, end: { x: 547, y }, thickness: 0.8, color: rgb(ar, ag, ab) });
    y -= 14;

    // ── Bill To ──────────────────────────────────────────────────────────────
    page.drawText("Bill To", { x: margin, y, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
    y -= 12;
    page.drawText(data.customerName.slice(0, 50), { x: margin, y, size: 11, font: bold });
    y -= 13;
    if (data.customerEmail) {
        page.drawText(data.customerEmail, { x: margin, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
        y -= 14;
    }
    y -= 10;

    // ── Table header ─────────────────────────────────────────────────────────
    page.drawLine({ start: { x: margin, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 14;
    page.drawText("Description", { x: margin, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("Qty", { x: 332, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("Unit Price", { x: 364, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("VAT", { x: 432, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText("Total", { x: 492, y, size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 12;

    // ── Line items ────────────────────────────────────────────────────────────
    for (let i = 0; i < Math.min(data.lineItems.length, 24); i++) {
        const item = data.lineItems[i];
        page.drawText(item.description.slice(0, 54), { x: margin, y, size: 8.5, font });
        page.drawText(String(Number(item.quantity)), { x: 332, y, size: 8.5, font });
        page.drawText(Number(item.unitPrice).toFixed(2), { x: 364, y, size: 8.5, font });
        page.drawText(Number(item.vatAmount).toFixed(2), { x: 432, y, size: 8.5, font });
        page.drawText(Number(item.total).toFixed(2), { x: 492, y, size: 8.5, font });
        y -= 14;
        page.drawLine({ start: { x: margin, y: y + 1 }, end: { x: 547, y: y + 1 }, thickness: 0.3, color: rgb(0.92, 0.92, 0.92) });
        if (y < 160) break;
    }

    y -= 10;

    // ── Totals — accent left border ──────────────────────────────────────────
    const totalsH = 62;
    page.drawRectangle({ x: 330, y: y - totalsH + 14, width: 4, height: totalsH, color: rgb(ar, ag, ab) });
    page.drawText(`Subtotal`, { x: 342, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
    page.drawText(money(data.subtotal, data.currency), { x: 460, y, size: 9, font });
    y -= 14;
    page.drawText(`VAT`, { x: 342, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
    page.drawText(money(data.totalVat, data.currency), { x: 460, y, size: 9, font });
    y -= 14;
    page.drawText(`Total`, { x: 342, y, size: 10.5, font: bold, color: rgb(ar, ag, ab) });
    page.drawText(money(data.total, data.currency), { x: 460, y, size: 10.5, font: bold, color: rgb(ar, ag, ab) });
    y -= 14;
    page.drawText(`Outstanding`, { x: 342, y, size: 10.5, font: bold, color: rgb(ar, ag, ab) });
    page.drawText(money(data.outstanding, data.currency), { x: 460, y, size: 10.5, font: bold, color: rgb(ar, ag, ab) });

    // ── Notes ────────────────────────────────────────────────────────────────
    if (data.notes && y > 100) {
        y -= 26;
        page.drawText("Notes", { x: margin, y, size: 9, font: bold });
        y -= 12;
        page.drawText(data.notes.slice(0, 280), { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) });
    }

    // ── FTA QR ───────────────────────────────────────────────────────────────
    if (data.qrCodeData) {
        try {
            const qrDataUrl = await QRCode.toDataURL(data.qrCodeData, { width: 140, margin: 1 });
            const qrImg = await pdf.embedPng(Buffer.from(qrDataUrl.split(",")[1], "base64"));
            page.drawImage(qrImg, { x: margin, y: 56, width: 55, height: 55 });
            page.drawText("FTA Compliant", { x: margin, y: 50, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
        } catch { /* ignore */ }
    }

    drawFooter(page, font, {
        phone: data.organizationPhone,
        website: data.organizationWebsite,
        address: data.organizationAddress,
        margin,
    });

    return pdf.save();
}
