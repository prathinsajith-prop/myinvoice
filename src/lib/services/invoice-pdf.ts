import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
    notes?: string | null;
    lineItems: InvoicePdfLineItem[];
}

function money(v: number, currency: string) {
    return `${currency} ${Number(v || 0).toFixed(2)}`;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 48;
    let y = 800;

    page.drawText(data.organizationName, { x: margin, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;
    if (data.organizationTrn) {
        page.drawText(`TRN: ${data.organizationTrn}`, { x: margin, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 16;
    }

    page.drawText(`Invoice ${data.invoiceNumber}`, { x: 380, y: 800, size: 14, font: bold });
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

    return pdf.save();
}
