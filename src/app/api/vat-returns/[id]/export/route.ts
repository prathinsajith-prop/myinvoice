import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const format = new URL(req.url).searchParams.get("format") ?? "csv";

        const vatReturn = await prisma.vatReturn.findFirst({
            where: { id, organizationId: ctx.organizationId },
        });
        if (!vatReturn) throw new NotFoundError("VAT return not found");

        const period = `${vatReturn.periodStart.toISOString().slice(0, 10)} to ${vatReturn.periodEnd.toISOString().slice(0, 10)}`;

        if (format === "csv") {
            const lines = [
                "Field,Amount (AED)",
                `Period,"${period}"`,
                `Status,"${vatReturn.status}"`,
                `Output VAT (Sales),"${Number(vatReturn.outputVat).toFixed(2)}"`,
                `Input VAT (Purchases),"${Number(vatReturn.inputVat).toFixed(2)}"`,
                `Net VAT Payable,"${Number(vatReturn.netVat).toFixed(2)}"`,
                `Due Date,"${vatReturn.dueDate?.toISOString().slice(0, 10) ?? ""}"`,
            ];
            return new NextResponse(lines.join("\n"), {
                status: 200,
                headers: {
                    "Content-Type": "text/csv",
                    "Content-Disposition": `attachment; filename="vat-return-${id}.csv"`,
                },
            });
        }

        // PDF — generate minimal HTML and return as text/html for download
        // (for full PDF generation, install puppeteer or pdfkit server-side)
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>VAT Return</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .sub { color: #888; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 14px; }
    th { background: #f5f5f5; }
    .total td { font-weight: bold; background: #f0f9ff; }
  </style>
</head>
<body>
  <h1>VAT Return</h1>
  <p class="sub">Period: ${period} &bull; Status: ${vatReturn.status}</p>
  <table>
    <thead><tr><th>Description</th><th>Amount (AED)</th></tr></thead>
    <tbody>
      <tr><td>Output VAT (Sales)</td><td>${Number(vatReturn.outputVat).toFixed(2)}</td></tr>
      <tr><td>Input VAT (Purchases)</td><td>${Number(vatReturn.inputVat).toFixed(2)}</td></tr>
      <tr class="total"><td>Net VAT Payable</td><td>${Number(vatReturn.netVat).toFixed(2)}</td></tr>
    </tbody>
  </table>
  ${vatReturn.dueDate ? `<p style="margin-top:16px;font-size:13px;color:#888;">Due Date: ${vatReturn.dueDate.toISOString().slice(0, 10)}</p>` : ""}
</body>
</html>`;

        return new NextResponse(html, {
            status: 200,
            headers: {
                "Content-Type": "text/html",
                "Content-Disposition": `attachment; filename="vat-return-${id}.html"`,
            },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
