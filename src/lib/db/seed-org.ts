/**
 * Seeds the three rows every new organization needs:
 *   - Subscription (FREE plan, TRIALING)
 *   - OrganizationSettings (VAT defaults)
 *   - DocumentSequence (one row per document type)
 *
 * Safe to call multiple times — uses upsert/createIfNotExists semantics.
 */

import prisma from "@/lib/db/prisma";
import { type DocumentType } from "@/generated/prisma";

const DOCUMENT_TYPES: DocumentType[] = [
    "INVOICE",
    "PROFORMA",
    "QUOTATION",
    "CREDIT_NOTE",
    "DEBIT_NOTE",
    "BILL",
    "DELIVERY_NOTE",
];

const PREFIX_MAP: Record<DocumentType, string> = {
    INVOICE: "INV",
    PROFORMA: "PI",
    QUOTATION: "QT",
    CREDIT_NOTE: "CN",
    DEBIT_NOTE: "DN",
    BILL: "BILL",
    DELIVERY_NOTE: "DN",
};

export async function seedNewOrganization(organizationId: string): Promise<void> {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

    await Promise.all([
        // Subscription — upsert so re-runs don't duplicate
        prisma.subscription.upsert({
            where: { organizationId },
            create: {
                organizationId,
                plan: "FREE",
                status: "TRIALING",
                trialEndsAt,
                monthlyInvoiceLimit: 10,
                teamMemberLimit: 1,
                storageGbLimit: 1,
                customersLimit: 50,
            },
            update: {},
        }),

        // OrganizationSettings — upsert
        prisma.organizationSettings.upsert({
            where: { organizationId },
            create: {
                organizationId,
            },
            update: {},
        }),
    ]);

    // DocumentSequence — one per type, skip if already exists
    for (const documentType of DOCUMENT_TYPES) {
        await prisma.documentSequence.upsert({
            where: {
                organizationId_documentType: { organizationId, documentType },
            },
            create: {
                organizationId,
                documentType,
                prefix: PREFIX_MAP[documentType],
                nextSequence: 1,
                padLength: 4,
            },
            update: {},
        });
    }
}
