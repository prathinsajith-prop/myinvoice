import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithPermission } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { generatePublicToken } from "@/lib/crypto/token";
import { sendEmail } from "@/lib/email";
import { invoiceEmail } from "@/lib/email/templates";
import { APP_URL } from "@/lib/constants/env";

type Params = { params: Promise<{ id: string }> };

const sendSchema = z.object({
    email: z.string().email().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "edit");
        const { id } = await params;

        const payload = sendSchema.safeParse(await req.json().catch(() => ({})));
        if (!payload.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: payload.error.flatten() },
                { status: 400 }
            );
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                organization: { select: { name: true, legalName: true } },
                customer: { select: { name: true, email: true } },
            },
        });

        if (!invoice) throw new NotFoundError("Invoice");

        const recipient = payload.data.email || invoice.customer.email;
        if (!recipient) {
            return NextResponse.json({ error: "Customer email is missing" }, { status: 400 });
        }

        const token = invoice.publicToken || generatePublicToken();
        if (!invoice.publicToken) {
            await prisma.invoice.update({ where: { id: invoice.id }, data: { publicToken: token } });
        }

        const appUrl = APP_URL || req.nextUrl.origin;
        const portalUrl = `${appUrl}/portal/${token}`;
        const pdfUrl = `${appUrl}/api/invoices/${invoice.id}/pdf`;

        const template = invoiceEmail({
            customerName: invoice.customer.name,
            organizationName: invoice.organization.legalName || invoice.organization.name,
            invoiceNumber: invoice.invoiceNumber,
            amount: Number(invoice.total),
            currency: invoice.currency,
            dueDate: invoice.dueDate.toLocaleDateString("en-AE"),
            portalUrl,
            pdfUrl,
        });

        const sent = await sendEmail({
            to: recipient,
            subject: template.subject,
            html: template.html,
            text: template.text,
        });

        if (!sent) {
            return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
        }

        await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
                status: invoice.status === "DRAFT" ? "SENT" : invoice.status,
                sentAt: new Date(),
            },
        });

        return NextResponse.json({ success: true, recipient, portalUrl });
    } catch (error) {
        return toErrorResponse(error);
    }
}
