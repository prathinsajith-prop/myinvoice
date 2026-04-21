/**
 * Shared PDF generation helpers used across all templates.
 */
import { rgb } from "pdf-lib";
import type { PDFDocument, PDFPage, PDFFont, PDFImage } from "pdf-lib";

export function hexToRgb(hex: string): [number, number, number] {
    const clean = (hex ?? "").replace("#", "").padEnd(6, "0");
    return [
        parseInt(clean.substring(0, 2), 16) / 255,
        parseInt(clean.substring(2, 4), 16) / 255,
        parseInt(clean.substring(4, 6), 16) / 255,
    ];
}

export function money(v: number, currency: string): string {
    return `${currency} ${Number(v || 0).toFixed(2)}`;
}

/** Embed org logo from base64 data URI or HTTP(S) URL. Silently skips on error. */
export async function embedLogo(
    pdf: PDFDocument,
    src: string | null | undefined
): Promise<PDFImage | null> {
    if (!src) return null;
    try {
        if (src.startsWith("data:image/png")) {
            return await pdf.embedPng(Buffer.from(src.split(",")[1], "base64"));
        }
        if (src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg")) {
            return await pdf.embedJpg(Buffer.from(src.split(",")[1], "base64"));
        }
        if (src.startsWith("http://") || src.startsWith("https://")) {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 5000);
            try {
                const res = await fetch(src, { signal: controller.signal });
                clearTimeout(tid);
                if (res.ok) {
                    const buf = await res.arrayBuffer();
                    const ct = res.headers.get("content-type") ?? "";
                    if (ct.includes("png")) return await pdf.embedPng(new Uint8Array(buf));
                    if (ct.includes("jpeg") || ct.includes("jpg")) return await pdf.embedJpg(new Uint8Array(buf));
                }
            } catch {
                clearTimeout(tid);
            }
        }
    } catch {
        // silently skip
    }
    return null;
}

/** Draw logo image on page, scaled to fit inside maxW × maxH, aligned to right margin. */
export function drawLogoRight(
    page: PDFPage,
    img: PDFImage,
    topY: number,
    maxW: number,
    maxH: number,
    rightEdge: number
): void {
    const dims = img.scaleToFit(maxW, maxH);
    page.drawImage(img, {
        x: rightEdge - dims.width,
        y: topY - dims.height,
        width: dims.width,
        height: dims.height,
    });
}

/** Render footer line + contact fields + generated-date on every page. */
export function drawFooter(
    page: PDFPage,
    font: PDFFont,
    opts: {
        phone?: string | null;
        website?: string | null;
        address?: string | null;
        margin: number;
    }
): void {
    const { phone, website, address, margin } = opts;

    page.drawLine({
        start: { x: margin, y: 40 },
        end: { x: 547, y: 40 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
    });
    let fx = margin;
    if (phone) {
        page.drawText(`Phone: ${phone}`, { x: fx, y: 26, size: 7.5, font, color: rgb(0.5, 0.5, 0.5) });
        fx += 155;
    }
    if (website) {
        page.drawText(`Web: ${website}`, { x: fx, y: 26, size: 7.5, font, color: rgb(0.5, 0.5, 0.5) });
    }
    if (address) {
        const short = address.split(",").slice(0, 2).join(", ").slice(0, 48);
        page.drawText(short, { x: margin, y: 14, size: 7.5, font, color: rgb(0.5, 0.5, 0.5) });
    }
    page.drawText(`Generated: ${new Date().toLocaleDateString("en-AE")}`, {
        x: 390,
        y: 26,
        size: 7.5,
        font,
        color: rgb(0.5, 0.5, 0.5),
    });
}
