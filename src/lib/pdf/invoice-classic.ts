/**
 * CLASSIC template — Traditional corporate style.
 * Solid colored header bar, ruled table, alternating row shading, accent totals box.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { InvoicePdfData } from "./types";
import { hexToRgb, money, embedLogo, drawLogoRight, drawFooter } from "./helpers";

export async function generateClassicInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 48;
    const [hr, hg, hb] = hexToRgb(data.primaryColor ?? "#1e3a8a");
    const [ar, ag, ab] = hexToRgb(data.accentColor ?? data.primaryColor ?? "#1e3a8a");

    // ── Header bar ───────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 796, width: 595, height: 46, color: rgb(hr, hg, hb) });
    page.drawText(data.organizationName.slice(0, 40), { x: margin, y: 812, size: 13, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`INVOICE ${data.invoiceNumber}`, { x: 380, y: 812, size: 11, font: bold, color: rgb(1, 1, 1) });

    // Logo
    const logoImg = await embedLogo(pdf, data.organizationLogo);
    if (logoImg) drawLogoRight(page, logoImg, 826, 80, 30, 547);

    // ── Sub-header ───────────────────────────────────────────────────────────
    let y = 782;
    if (data.organizationTrn) {
        page.drawText(`TRN: ${data.organizationTrn}`, { x: margin, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 14;
    }

    page.drawText(`Issue Date: ${data.issueDate.toLocaleDateString("en-AE")}`, { x: 350, y: 782, size: 9, font });
    page.drawText(`Due Date: ${data.dueDate.toLocaleDateString("en-AE")}`, { x: 350, y: 769, size: 9, font });

    // ── Bill To ──────────────────────────────────────────────────────────────
    y -= 10;
    page.drawText("BILL TO", { x: margin, y, size: 8, font: bold, color: rgb(ar, ag, ab) });
    y -= 12;
    page.drawText(data.customerName.slice(0, 50), { x: margin, y, size: 10, font: bold });
    y -= 13;
    if (data.customerEmail) {
        page.drawText(data.customerEmail, { x: margin, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
        y -= 13;
    }

    // ── Divider ──────────────────────────────────────────────────────────────
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 14;

    // ── Table header ─────────────────────────────────────────────────────────
    page.drawRectangle({ x: margin - 2, y: y - 4, width: 503, height: 16, color: rgb(hr, hg, hb) });
    page.drawText("DESCRIPTION", { x: margin + 2, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText("QTY", { x: 332, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText("UNIT", { x: 368, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText("VAT", { x: 432, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText("TOTAL", { x: 492, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
    y -= 16;

    // ── Line items ────────────────────────────────────────────────────────────
    for (let i = 0; i < Math.min(data.lineItems.length, 24); i++) {
        const item = data.lineItems[i];
        if (i % 2 === 0) {
            page.drawRectangle({ x: margin - 2, y: y - 4, width: 503, height: 14, color: rgb(0.97, 0.97, 0.97) });
        }
        page.drawText(item.description.slice(0, 54), { x: margin + 2, y, size: 8.5, font });
        page.drawText(String(Number(item.quantity)), { x: 332, y, size: 8.5, font });
        page.drawText(Number(item.unitPrice).toFixed(2), { x: 368, y, size: 8.5, font });
        page.drawText(Number(item.vatAmount).toFixed(2), { x: 432, y, size: 8.5, font });
        page.drawText(Number(item.total).toFixed(2), { x: 492, y, size: 8.5, font });
        y -= 14;
        if (y < 160) break;
    }

    y -= 4;
    page.drawLine({ start: { x: 330, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 14;

    // ── Totals box ───────────────────────────────────────────────────────────
    const boxH = 58;
    page.drawRectangle({ x: 330, y: y - boxH + 14, width: 217, height: boxH, color: rgb(ar * 0.92 + 0.08, ag * 0.92 + 0.08, ab * 0.92 + 0.08) });
    page.drawText(`Subtotal: ${money(data.subtotal, data.currency)}`, { x: 338, y, size: 9.5, font });
    y -= 14;
    page.drawText(`VAT: ${money(data.totalVat, data.currency)}`, { x: 338, y, size: 9.5, font });
    y -= 14;
    page.drawText(`Total: ${money(data.total, data.currency)}`, { x: 338, y, size: 10.5, font: bold, color: rgb(ar, ag, ab) });
    y -= 14;
    page.drawText(`Outstanding: ${money(data.outstanding, data.currency)}`, { x: 338, y, size: 10.5, font: bold, color: rgb(ar, ag, ab) });

    // ── Notes ────────────────────────────────────────────────────────────────
    if (data.notes && y > 100) {
        y -= 24;
        page.drawText("Notes", { x: margin, y, size: 9, font: bold });
        y -= 12;
        page.drawText(data.notes.slice(0, 280), { x: margin, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) });
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
