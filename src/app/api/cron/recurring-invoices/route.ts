import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { CRON_SECRET } from "@/lib/constants/env";
import { getNextDocumentNumber } from "@/lib/services/numbering";
import { generatePublicToken } from "@/lib/crypto/token";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/services/vat";
import { generateFtaQrPayload } from "@/lib/services/fta-qr";
import { sendEmail } from "@/lib/email";
import { invoiceEmail } from "@/lib/email/templates";
import { APP_URL } from "@/lib/constants/env";
import type { InvoiceType, VatTreatment } from "@/generated/prisma";

function computeNextRunDate(current: Date, frequency: string): Date {
    const d = new Date(current);
    switch (frequency) {
        case "WEEKLY": d.setDate(d.getDate() + 7); break;
        case "BIWEEKLY": d.setDate(d.getDate() + 14); break;
        case "MONTHLY": d.setMonth(d.getMonth() + 1); break;
        case "QUARTERLY": d.setMonth(d.getMonth() + 3); break;
        case "SEMI_ANNUALLY": d.setMonth(d.getMonth() + 6); break;
        case "ANNUALLY": d.setFullYear(d.getFullYear() + 1); break;
    }
    return d;
}

/**
 * POST /api/cron/recurring-invoices
 * Secured by CRON_SECRET header. Call via Vercel Cron or external scheduler.
 */
export async function POST(req: NextRequest) {
    // Authenticate cron request
    const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
    if (!CRON_SECRET || secret !== CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let generated = 0;
    let errors = 0;

    // Find all active recurring invoices due to run
    const due = await prisma.recurringInvoice.findMany({
        where: {
            status: "ACTIVE",
            nextRunDate: { lte: now },
            deletedAt: null,
        },
        include: {
            lineItems: { orderBy: { sortOrder: "asc" } },
            customer: { select: { id: true, name: true, email: true, trn: true, type: true } },
            organization: { select: { id: true, name: true, legalName: true, trn: true } },
        },
    });

    for (const ri of due) {
        try {
            // Check if end date has passed
            if (ri.endDate && ri.endDate <= now) {
                await prisma.recurringInvoice.update({
                    where: { id: ri.id },
                    data: { status: "COMPLETED" },
                });
                continue;
            }

            // Check occurrences
            if (ri.occurrencesLeft !== null && ri.occurrencesLeft <= 0) {
                await prisma.recurringInvoice.update({
                    where: { id: ri.id },
                    data: { status: "COMPLETED" },
                });
                continue;
            }

            // Calculate line items using VAT engine
            const calculatedItems = ri.lineItems.map((item) => {
                const calc = calculateLineItem({
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    discount: Number(item.discount),
                    vatTreatment: item.vatTreatment as VatTreatment,
                    vatRate: Number(item.vatRate),
                });
                return { ...calc, item };
            });
            const totals = calculateDocumentTotals(calculatedItems.map((c) => c));

            const invoiceNumber = await getNextDocumentNumber(ri.organizationId, "INVOICE");
            const issueDateValue = new Date();

            const qrCodeData = ri.organization.trn
                ? generateFtaQrPayload({
                    sellerName: ri.organization.legalName || ri.organization.name,
                    trn: ri.organization.trn,
                    timestampIso: issueDateValue.toISOString(),
                    invoiceTotal: totals.total,
                    vatTotal: totals.totalVat,
                })
                : null;

            // Create the invoice
            const invoice = await prisma.invoice.create({
                data: {
                    organizationId: ri.organizationId,
                    customerId: ri.customerId,
                    recurringInvoiceId: ri.id,
                    invoiceNumber,
                    invoiceType: ri.invoiceType as InvoiceType,
                    issueDate: issueDateValue,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    currency: ri.currency,
                    exchangeRate: ri.exchangeRate,
                    notes: ri.notes,
                    terms: ri.terms,
                    publicToken: generatePublicToken(),
                    status: "SENT",
                    qrCodeData,
                    ftaCompliant: Boolean(ri.organization.trn && qrCodeData),
                    sellerTrn: ri.organization.trn ?? null,
                    buyerTrn: ri.customer.trn ?? null,
                    subtotal: totals.subtotal,
                    totalVat: totals.totalVat,
                    discount: totals.discount,
                    total: totals.total,
                    outstanding: totals.total,
                    lineItems: {
                        create: calculatedItems.map(({ item, ...calc }, i) => ({
                            productId: item.productId ?? null,
                            description: item.description,
                            quantity: Number(item.quantity),
                            unitPrice: Number(item.unitPrice),
                            unitOfMeasure: item.unitOfMeasure ?? "unit",
                            discount: Number(item.discount) ?? 0,
                            vatTreatment: (item.vatTreatment as VatTreatment) ?? "STANDARD_RATED",
                            vatRate: calc.effectiveVatRate,
                            subtotal: calc.subtotal,
                            vatAmount: calc.vatAmount,
                            total: calc.total,
                            sortOrder: item.sortOrder ?? i,
                        })),
                    },
                },
            });

            // Update recurring invoice state
            const nextRun = computeNextRunDate(ri.nextRunDate, ri.frequency);
            const newOccurrences = ri.occurrencesLeft !== null ? ri.occurrencesLeft - 1 : null;

            await prisma.recurringInvoice.update({
                where: { id: ri.id },
                data: {
                    nextRunDate: nextRun,
                    lastRunDate: now,
                    invoicesGenerated: { increment: 1 },
                    ...(newOccurrences !== null ? { occurrencesLeft: newOccurrences } : {}),
                    ...(newOccurrences === 0 ? { status: "COMPLETED" } : {}),
                    ...(ri.endDate && nextRun > ri.endDate ? { status: "COMPLETED" } : {}),
                },
            });

            // Auto-send email if enabled
            if (ri.autoSend && ri.customer.email) {
                const appUrl = APP_URL || "https://myinvoice.ae";
                const portalUrl = `${appUrl}/portal/${invoice.publicToken}`;

                const template = invoiceEmail({
                    customerName: ri.customer.name,
                    organizationName: ri.organization.legalName || ri.organization.name,
                    invoiceNumber: invoice.invoiceNumber,
                    amount: totals.total,
                    currency: ri.currency,
                    dueDate: invoice.dueDate.toLocaleDateString("en-AE"),
                    portalUrl,
                    pdfUrl: `${appUrl}/api/invoices/${invoice.id}/pdf`,
                });

                sendEmail({
                    to: ri.customer.email,
                    subject: template.subject,
                    html: template.html,
                }).catch(() => { }); // fire-and-forget
            }

            generated++;
        } catch (err) {
            errors++;
            console.error(`[cron] Failed to process recurring invoice ${ri.id}:`, err);
        }
    }

    return NextResponse.json({
        processed: due.length,
        generated,
        errors,
        timestamp: now.toISOString(),
    });
}
