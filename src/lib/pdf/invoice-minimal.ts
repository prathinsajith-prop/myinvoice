/**
 * MINIMAL template — Lightweight, no fills, clean typography,
 * single thin-line separators, simple right-aligned totals.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { InvoicePdfData } from "./types";
import { hexToRgb, money, embedLogo, drawLogoRight, drawFooter } from "./helpers";

export async function generateMinimalInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 56;
    const [ar, ag, ab] = hexToRgb(data.accentColor ?? data.primaryColor ?? "#111827");

    // ── Logo (top-right, no background) ──────────────────────────────────────
    const logoImg = await embedLogo(pdf, data.organizationLogo);
    if (logoImg) drawLogoRight(page, logoImg, 822, 90, 34, 539);

    // ── Org block ────────────────────────────────────────────────────────────
    page.drawText(data.organizationName.slice(0, 42), { x: margin, y: 808, size: 15, font: bold, color: rgb(ar, ag, ab) });
    let orgY = 793;
    if (data.organizationTrn) {
        page.drawText(`TRN: ${data.organizationTrn}`, { x: margin, y: orgY, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) });
        orgY -= 12;
    }
    if (data.organizationPhone) {
        page.drawText(data.organizationPhone, { x: margin, y: orgY, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) });
    }

    // ── Invoice meta (right column) ──────────────────────────────────────────
    page.drawText("Invoice", { x: 380, y: 808, size: 11, font: bold, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`#${data.invoiceNumber}`, { x: 380, y: 793, size: 9.5, font, color: rgb(0.35, 0.35, 0.35) });
    page.drawText(data.issueDate.toLocaleDateString("en-AE"), { x: 380, y: 779, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });
    page.drawText(`Due ${data.dueDate.toLocaleDateString("en-AE")}`, { x: 380, y: 766, size: 8.5, font, color: rgb(0.45, 0.45, 0.45) });

    // ── Full-width rule ───────────────────────────────────────────────────────
    let y = 752;
    page.drawLine({ start: { x: margin, y }, end: { x: 539, y }, thickness: 1, color: rgb(ar, ag, ab) });
    y -= 14;

    // ── Bill to ───────────────────────────────────────────────────────────────
    page.drawText("Bill to", { x: margin, y, size: 7.5, font, color: rgb(0.6, 0.6, 0.6) });
    y -= 12;
    page.drawText(data.customerName.slice(0, 50), { x: margin, y, size: 10, font: bold });
    y -= 13;
    if (data.customerEmail) {
        page.drawText(data.customerEmail, { x: margin, y, size: 8.5, font, color: rgb(0.5, 0.5, 0.5) });
        y -= 13;
    }
    y -= 12;

    // ── Column headers ────────────────────────────────────────────────────────
    page.drawText("Description", { x: margin, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("Qty", { x: 330, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("Unit Price", { x: 366, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("VAT", { x: 432, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("Total", { x: 492, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) });
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: 539, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 12;

    // ── Line items ────────────────────────────────────────────────────────────
    for (let i = 0; i < Math.min(data.lineItems.length, 24); i++) {
        const item = data.lineItems[i];
        page.drawText(item.description.slice(0, 56), { x: margin, y, size: 8.5, font });
        page.drawText(String(Number(item.quantity)), { x: 330, y, size: 8.5, font });
        page.drawText(Number(item.unitPrice).toFixed(2), { x: 366, y, size: 8.5, font });
        page.drawText(Number(item.vatAmount).toFixed(2), { x: 432, y, size: 8.5, font });
        page.drawText(Number(item.total).toFixed(2), { x: 492, y, size: 8.5, font });
        y -= 14;
        if (y < 160) break;
    }

    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: 539, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 14;

    // ── Totals (right-aligned, no box) ────────────────────────────────────────
    const tx = 380;
    page.drawText("Subtotal", { x: tx, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
    page.drawText(money(data.subtotal, data.currency), { x: 460, y, size: 9, font });
    y -= 13;
    page.drawText("VAT", { x: tx, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
    page.drawText(money(data.totalVat, data.currency), { x: 460, y, size: 9, font });
    y -= 6;
    page.drawLine({ start: { x: tx, y }, end: { x: 539, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 11;
    page.drawText("Total", { x: tx, y, size: 11, font: bold, color: rgb(ar, ag, ab) });
    page.drawText(money(data.total, data.currency), { x: 460, y, size: 11, font: bold, color: rgb(ar, ag, ab) });
    y -= 14;
    page.drawText("Outstanding", { x: tx, y, size: 9.5, font: bold, color: rgb(ar, ag, ab) });
    page.drawText(money(data.outstanding, data.currency), { x: 460, y, size: 9.5, font: bold, color: rgb(ar, ag, ab) });

    // ── Notes ────────────────────────────────────────────────────────────────
    if (data.notes && y > 100) {
        y -= 24;
        page.drawText("Notes", { x: margin, y, size: 8.5, font: bold });
        y -= 12;
        page.drawText(data.notes.slice(0, 280), { x: margin, y, size: 8, font, color: rgb(0.45, 0.45, 0.45) });
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
