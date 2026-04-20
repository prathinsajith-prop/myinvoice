import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface DocLineItem {
    description: string;
    quantity: number;
    unitPrice?: number;
    discount?: number;
    vatAmount?: number;
    total?: number;
    unitOfMeasure?: string;
    notes?: string;
}

export interface DocumentPdfData {
    docType: "BILL" | "QUOTATION" | "CREDIT_NOTE" | "DEBIT_NOTE" | "PURCHASE_ORDER" | "DELIVERY_NOTE";
    docNumber: string;
    status?: string;
    currency: string;
    issueDate: Date;
    dueDate?: Date | null;
    expiryDate?: Date | null;
    expectedDate?: Date | null;
    deliveryDate?: Date | null;
    subtotal?: number;
    totalVat?: number;
    totalDiscount?: number;
    total?: number;
    outstanding?: number;
    // Party
    partyName: string;
    partyEmail?: string | null;
    partyType: "customer" | "supplier";
    // Org
    organizationName: string;
    organizationTrn?: string | null;
    organizationLogo?: string | null;
    organizationPhone?: string | null;
    organizationWebsite?: string | null;
    organizationAddress?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
    // Misc
    reference?: string | null;
    shippingAddress?: string | null;
    trackingNumber?: string | null;
    carrier?: string | null;
    driverName?: string | null;
    vehicleNumber?: string | null;
    notes?: string | null;
    terms?: string | null;
    lineItems: DocLineItem[];
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

const DOC_LABELS: Record<DocumentPdfData["docType"], string> = {
    BILL: "Bill",
    QUOTATION: "Quotation",
    CREDIT_NOTE: "Credit Note",
    DEBIT_NOTE: "Debit Note",
    PURCHASE_ORDER: "Purchase Order",
    DELIVERY_NOTE: "Delivery Note",
};

export async function generateDocumentPdf(data: DocumentPdfData): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 48;
    const docLabel = DOC_LABELS[data.docType];
    const [hr, hg, hb] = hexToRgb(data.primaryColor ?? "#1e3a8a");
    const [ar, ag, ab] = hexToRgb(data.accentColor ?? data.primaryColor ?? "#1e3a8a");

    // ── Header bar ─────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 796, width: 595, height: 46, color: rgb(hr, hg, hb) });
    page.drawText(data.organizationName, { x: margin, y: 811, size: 14, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`${docLabel} ${data.docNumber}`, { x: 380, y: 811, size: 12, font: bold, color: rgb(1, 1, 1) });

    // Optional logo
    if (data.organizationLogo) {
        try {
            let logoImg;
            const src = data.organizationLogo;
            if (src.startsWith("data:image/png")) {
                logoImg = await pdf.embedPng(Buffer.from(src.split(",")[1], "base64"));
            } else if (src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg")) {
                logoImg = await pdf.embedJpg(Buffer.from(src.split(",")[1], "base64"));
            } else if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                try {
                    const response = await fetch(src, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (response.ok) {
                        const buf = await response.arrayBuffer();
                        const ct = response.headers.get("content-type") ?? "";
                        if (ct.includes("png")) logoImg = await pdf.embedPng(new Uint8Array(buf));
                        else if (ct.includes("jpeg") || ct.includes("jpg")) logoImg = await pdf.embedJpg(new Uint8Array(buf));
                    }
                } catch { clearTimeout(timeoutId); }
            }
            if (logoImg) {
                const dims = logoImg.scaleToFit(80, 32);
                page.drawImage(logoImg, { x: 595 - margin - dims.width, y: 813 - dims.height, width: dims.width, height: dims.height });
            }
        } catch { /* ignore */ }
    }

    // ── Sub-header (TRN + dates) ────────────────────────────────────────────────
    let y = 784;
    if (data.organizationTrn) {
        page.drawText(`TRN: ${data.organizationTrn}`, { x: margin, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 16;
    }

    // Right-side dates
    let dateY = 784;
    page.drawText(`Issue: ${data.issueDate.toLocaleDateString("en-AE")}`, { x: 380, y: dateY, size: 10, font });
    dateY -= 14;
    if (data.dueDate) { page.drawText(`Due: ${data.dueDate.toLocaleDateString("en-AE")}`, { x: 380, y: dateY, size: 10, font }); dateY -= 14; }
    if (data.expiryDate) { page.drawText(`Expires: ${data.expiryDate.toLocaleDateString("en-AE")}`, { x: 380, y: dateY, size: 10, font }); dateY -= 14; }
    if (data.expectedDate) { page.drawText(`Expected: ${data.expectedDate.toLocaleDateString("en-AE")}`, { x: 380, y: dateY, size: 10, font }); dateY -= 14; }
    if (data.deliveryDate) { page.drawText(`Delivered: ${data.deliveryDate.toLocaleDateString("en-AE")}`, { x: 380, y: dateY, size: 10, font }); dateY -= 14; }
    if (data.reference) { page.drawText(`Ref: ${data.reference}`, { x: 380, y: dateY, size: 10, font, color: rgb(0.35, 0.35, 0.35) }); dateY -= 14; }

    y -= 8;
    const partyLabel = data.partyType === "customer" ? "Bill To" : "Supplier";
    page.drawText(partyLabel, { x: margin, y, size: 11, font: bold });
    y -= 14;
    page.drawText(data.partyName, { x: margin, y, size: 10, font });
    y -= 12;
    if (data.partyEmail) {
        page.drawText(data.partyEmail, { x: margin, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 14;
    }

    // Shipping address (for PO and Delivery Notes)
    if (data.shippingAddress) {
        y -= 4;
        const label = data.docType === "DELIVERY_NOTE" ? "Delivery Address" : "Ship To";
        page.drawText(label, { x: margin, y, size: 9, font: bold, color: rgb(0.35, 0.35, 0.35) });
        y -= 12;
        page.drawText(data.shippingAddress.slice(0, 80), { x: margin, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 14;
    }

    // ── Line items table ────────────────────────────────────────────────────────
    const isDelivery = data.docType === "DELIVERY_NOTE";
    y -= 8;

    if (isDelivery) {
        // Delivery note: Description | Qty | UoM | Notes
        page.drawText("Description", { x: margin, y, size: 10, font: bold });
        page.drawText("Qty", { x: 360, y, size: 10, font: bold });
        page.drawText("Unit", { x: 400, y, size: 10, font: bold });
        page.drawText("Notes", { x: 455, y, size: 10, font: bold });
    } else {
        // Financial docs: Description | Qty | Unit Price | Disc % | VAT | Total
        page.drawText("Description", { x: margin, y, size: 10, font: bold });
        page.drawText("Qty", { x: 300, y, size: 10, font: bold });
        page.drawText("Price", { x: 345, y, size: 10, font: bold });
        page.drawText("Disc%", { x: 400, y, size: 10, font: bold });
        page.drawText("VAT", { x: 450, y, size: 10, font: bold });
        page.drawText("Total", { x: 505, y, size: 10, font: bold });
    }

    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
    y -= 14;

    for (let i = 0; i < Math.min(data.lineItems.length, 22); i++) {
        const item = data.lineItems[i];
        if (i % 2 === 0) {
            page.drawRectangle({ x: margin - 2, y: y - 12, width: 515, height: 14, color: rgb(0.97, 0.97, 0.97) });
        }
        if (isDelivery) {
            page.drawText((item.description ?? "").slice(0, 48), { x: margin, y, size: 9, font });
            page.drawText(String(Number(item.quantity)), { x: 360, y, size: 9, font });
            page.drawText((item.unitOfMeasure ?? "").slice(0, 8), { x: 400, y, size: 9, font });
            if (item.notes) page.drawText(item.notes.slice(0, 20), { x: 455, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
        } else {
            page.drawText((item.description ?? "").slice(0, 46), { x: margin, y, size: 9, font });
            page.drawText(String(Number(item.quantity)), { x: 300, y, size: 9, font });
            page.drawText(Number(item.unitPrice ?? 0).toFixed(2), { x: 345, y, size: 9, font });
            page.drawText(Number(item.discount ?? 0) > 0 ? `${item.discount}%` : "—", { x: 400, y, size: 9, font });
            page.drawText(Number(item.vatAmount ?? 0).toFixed(2), { x: 450, y, size: 9, font });
            page.drawText(Number(item.total ?? 0).toFixed(2), { x: 505, y, size: 9, font });
        }
        y -= 14;
        if (y < 160) break;
    }

    // ── Totals section (for financial docs only) ────────────────────────────────
    if (!isDelivery && data.subtotal !== undefined) {
        y -= 6;
        page.drawLine({ start: { x: 330, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
        y -= 18;

        page.drawRectangle({ x: 330, y: y - (data.totalDiscount ? 72 : 58), width: 215, height: data.totalDiscount ? 70 : 56, color: rgb(ar * 0.95, ag * 0.95, ab * 0.95) });

        page.drawText(`Subtotal: ${money(data.subtotal, data.currency)}`, { x: 355, y, size: 10, font });
        y -= 14;
        if (data.totalDiscount && data.totalDiscount > 0) {
            page.drawText(`Discount: -${money(data.totalDiscount, data.currency)}`, { x: 355, y, size: 10, font, color: rgb(0.1, 0.5, 0.1) });
            y -= 14;
        }
        page.drawText(`VAT: ${money(data.totalVat ?? 0, data.currency)}`, { x: 355, y, size: 10, font });
        y -= 14;
        page.drawText(`Total: ${money(data.total ?? 0, data.currency)}`, { x: 355, y, size: 11, font: bold, color: rgb(ar, ag, ab) });
        y -= 14;
        if (data.outstanding !== undefined) {
            page.drawText(`Outstanding: ${money(data.outstanding, data.currency)}`, { x: 355, y, size: 11, font: bold, color: rgb(ar, ag, ab) });
        }
    }

    // ── Delivery note logistics info ────────────────────────────────────────────
    if (isDelivery) {
        y -= 12;
        const logistics = [
            data.trackingNumber && `Tracking: ${data.trackingNumber}`,
            data.carrier && `Carrier: ${data.carrier}`,
            data.driverName && `Driver: ${data.driverName}`,
            data.vehicleNumber && `Vehicle: ${data.vehicleNumber}`,
        ].filter(Boolean) as string[];
        if (logistics.length) {
            page.drawText("Logistics", { x: margin, y, size: 10, font: bold });
            y -= 13;
            logistics.forEach((info) => {
                page.drawText(info, { x: margin, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
                y -= 12;
            });
        }
    }

    // ── Notes / Terms ───────────────────────────────────────────────────────────
    if (data.notes && y > 80) {
        y -= 14;
        page.drawText("Notes", { x: margin, y, size: 10, font: bold });
        y -= 12;
        page.drawText(data.notes.slice(0, 300), { x: margin, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 12;
    }
    if (data.terms && y > 80) {
        y -= 8;
        page.drawText("Terms & Conditions", { x: margin, y, size: 10, font: bold });
        y -= 12;
        page.drawText(data.terms.slice(0, 300), { x: margin, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
    }

    // ── Footer ──────────────────────────────────────────────────────────────────
    page.drawLine({ start: { x: margin, y: 40 }, end: { x: 545, y: 40 }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    let footerX = margin;
    if (data.organizationPhone) {
        page.drawText(`Phone: ${data.organizationPhone}`, { x: footerX, y: 25, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
        footerX += 150;
    }
    if (data.organizationWebsite) {
        page.drawText(`Web: ${data.organizationWebsite}`, { x: footerX, y: 25, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    }
    if (data.organizationAddress) {
        const addressShort = data.organizationAddress.split(",").slice(0, 2).join(", ").slice(0, 45);
        page.drawText(addressShort, { x: margin, y: 14, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    }
    page.drawText(`Generated: ${new Date().toLocaleDateString("en-AE")}`, { x: 400, y: 25, size: 8, font, color: rgb(0.5, 0.5, 0.5) });

    return pdf.save();
}
