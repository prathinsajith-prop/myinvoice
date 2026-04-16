import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { CRON_SECRET, APP_URL } from "@/lib/constants/env";
import { sendEmail } from "@/lib/email";
import { paymentReminderEmail } from "@/lib/email/templates";

/**
 * POST /api/cron/payment-reminders
 * Processes pending payment reminders whose scheduledAt has passed.
 * Secured by CRON_SECRET header.
 */
export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
    if (!CRON_SECRET || secret !== CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const pending = await prisma.paymentReminder.findMany({
        where: {
            status: "PENDING",
            scheduledAt: { lte: now },
        },
        include: {
            invoice: {
                select: {
                    id: true,
                    invoiceNumber: true,
                    total: true,
                    outstanding: true,
                    currency: true,
                    dueDate: true,
                    status: true,
                    publicToken: true,
                    customer: { select: { name: true, email: true } },
                    organization: { select: { name: true, legalName: true } },
                },
            },
        },
    });

    for (const reminder of pending) {
        try {
            const inv = reminder.invoice;

            // Skip if invoice is already paid or voided
            if (["PAID", "VOID", "CREDITED"].includes(inv.status)) {
                await prisma.paymentReminder.update({
                    where: { id: reminder.id },
                    data: { status: "SKIPPED", failReason: `Invoice is ${inv.status}` },
                });
                skipped++;
                continue;
            }

            const recipient = reminder.recipient || inv.customer?.email;
            if (!recipient) {
                await prisma.paymentReminder.update({
                    where: { id: reminder.id },
                    data: { status: "FAILED", failReason: "No recipient email" },
                });
                failed++;
                continue;
            }

            // Only EMAIL channel is supported for now
            if (reminder.channel !== "EMAIL") {
                await prisma.paymentReminder.update({
                    where: { id: reminder.id },
                    data: { status: "SKIPPED", failReason: `Channel ${reminder.channel} not yet supported` },
                });
                skipped++;
                continue;
            }

            const appUrl = APP_URL || "https://myinvoice.ae";
            const portalUrl = inv.publicToken
                ? `${appUrl}/portal/${inv.publicToken}`
                : `${appUrl}`;

            // Use custom subject/body if provided, otherwise use template
            let subject: string;
            let html: string;

            if (reminder.subject && reminder.body) {
                subject = reminder.subject;
                html = reminder.body;
            } else {
                const template = paymentReminderEmail({
                    customerName: inv.customer?.name ?? "Customer",
                    organizationName: inv.organization?.legalName || inv.organization?.name || "",
                    invoiceNumber: inv.invoiceNumber,
                    amount: Number(inv.total),
                    currency: inv.currency,
                    outstanding: Number(inv.outstanding),
                    dueDate: inv.dueDate.toLocaleDateString("en-AE"),
                    portalUrl,
                    reminderType: reminder.type as "BEFORE_DUE" | "ON_DUE" | "AFTER_DUE",
                });
                subject = template.subject;
                html = template.html;
            }

            await sendEmail({ to: recipient, subject, html });

            await prisma.paymentReminder.update({
                where: { id: reminder.id },
                data: { status: "SENT", sentAt: new Date() },
            });

            sent++;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            await prisma.paymentReminder.update({
                where: { id: reminder.id },
                data: { status: "FAILED", failReason: message },
            });
            failed++;
            console.error(`[cron] Failed to send reminder ${reminder.id}:`, err);
        }
    }

    return NextResponse.json({
        processed: pending.length,
        sent,
        failed,
        skipped,
        timestamp: now.toISOString(),
    });
}
