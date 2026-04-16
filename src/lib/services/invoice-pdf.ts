import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

interface InvoicePdfLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    vatAmount: number;
    total: number;
}

interface InvoicePdfData {
    invoiceNumber: string;
    issueDate: Date;
    dueDate: Date;
    currency: string;
    subtotal: number;
    totalVat: number;
    total: number;
    outstanding: number;
    customerName: string;
    customerEmail?: string | null;
    organizationName: string;
    organizationTrn?: string | null;
    organizationLogo?: string | null;
    primaryColor?: string | null;
    notes?: string | null;
    lineItems: InvoicePdfLineItem[];
    qrCodeData?: string | null;
}

function money(v: number, currency: string) {
    return `${currency} ${Number(v || 0).toFixed(2)}`;
}

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace("#", "").padEnd(6, "0");
    return [
        parseInt(clean.substring(0, 2), 16) / 255,
        parseInt(clean.substring(2, 4), 16) / 255,
        parseInt(clean.substring(4, 6), 16) / 255,
    ];
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 48;
    let y = 800;

    // Colored header bar
    const [hr, hg, hb] = hexToRgb(data.primaryColor ?? "#1e3a8a");
    page.drawRectangle({ x: 0, y: 796, width: 595, height: 46, color: rgb(hr, hg, hb) });

    // Org name and invoice number in the header bar (white text)
    page.drawText(data.organizationName, { x: margin, y: 811, size: 14, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`Invoice ${data.invoiceNumber}`, { x: 380, y: 811, size: 12, font: bold, color: rgb(1, 1, 1) });

    // Optional org logo (right side of header bar)
    if (data.organizationLogo) {
        try {
            let logoImg;
            const logoSrc = data.organizationLogo;
            if (logoSrc.startsWith("data:image/png")) {
                logoImg = await pdf.embedPng(Buffer.from(logoSrc.split(",")[1], "base64"));
            } else if (logoSrc.startsWith("data:image/jpeg") || logoSrc.startsWith("data:image/jpg")) {
                logoImg = await pdf.embedJpg(Buffer.from(logoSrc.split(",")[1], "base64"));
            }
            if (logoImg) {
                const dims = logoImg.scaleToFit(80, 32);
                page.drawImage(logoImg, { x: 595 - margin - dims.width, y: 813 - dims.height, width: dims.width, height: dims.height });
            }
        } catch {
            // ignore logo embedding errors
        }
    }

    y = 784;
    if (data.organizationTrn) {
        page.drawText(`TRN: ${data.organizationTrn}`, { x: margin, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 16;
    }

    page.drawText(`Issue: ${data.issueDate.toLocaleDateString("en-AE")}`, { x: 380, y: 784, size: 10, font });
    page.drawText(`Due: ${data.dueDate.toLocaleDateString("en-AE")}`, { x: 380, y: 770, size: 10, font });

    y -= 24;
    page.drawText("Bill To", { x: margin, y, size: 11, font: bold });
    y -= 14;
    page.drawText(data.customerName, { x: margin, y, size: 10, font });
    y -= 12;
    if (data.customerEmail) {
        page.drawText(data.customerEmail, { x: margin, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 18;
    }

    y -= 8;
    page.drawText("Description", { x: margin, y, size: 10, font: bold });
    page.drawText("Qty", { x: 330, y, size: 10, font: bold });
    page.drawText("Unit", { x: 380, y, size: 10, font: bold });
    page.drawText("VAT", { x: 450, y, size: 10, font: bold });
    page.drawText("Total", { x: 510, y, size: 10, font: bold });
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
    y -= 14;

    for (const item of data.lineItems.slice(0, 24)) {
        page.drawText(item.description.slice(0, 52), { x: margin, y, size: 9, font });
        page.drawText(String(Number(item.quantity)), { x: 330, y, size: 9, font });
        page.drawText(Number(item.unitPrice).toFixed(2), { x: 380, y, size: 9, font });
        page.drawText(Number(item.vatAmount).toFixed(2), { x: 450, y, size: 9, font });
        page.drawText(Number(item.total).toFixed(2), { x: 510, y, size: 9, font });
        y -= 14;
        if (y < 150) break;
    }

    y -= 6;
    page.drawLine({ start: { x: 340, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
    y -= 18;
    page.drawText(`Subtotal: ${money(data.subtotal, data.currency)}`, { x: 370, y, size: 10, font });
    y -= 14;
    page.drawText(`VAT: ${money(data.totalVat, data.currency)}`, { x: 370, y, size: 10, font });
    y -= 14;
    page.drawText(`Total: ${money(data.total, data.currency)}`, { x: 370, y, size: 11, font: bold });
    y -= 14;
    page.drawText(`Outstanding: ${money(data.outstanding, data.currency)}`, { x: 370, y, size: 11, font: bold });

    if (data.notes) {
        y -= 28;
        page.drawText("Notes", { x: margin, y, size: 10, font: bold });
        y -= 12;
        page.drawText(data.notes.slice(0, 300), { x: margin, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
    }

    // Add FTA QR code if available
    if (data.qrCodeData) {
        try {
            const qrImage = await QRCode.toDataURL(data.qrCodeData, {
                width: 150,
                margin: 1,
                color: { dark: "#000000", light: "#FFFFFF" },
            });
            const qrBase64 = qrImage.split(",")[1];
            const qrImageData = await pdf.embedPng(Buffer.from(qrBase64, "base64"));
            page.drawImage(qrImageData, { x: 48, y: 60, width: 60, height: 60 });
            page.drawText("FTA Compliant", { x: 48, y: 55, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
        } catch (error) {
            console.error("Failed to embed QR code:", error);
        }
    }

    return pdf.save();
}
