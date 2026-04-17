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

    // Optional sample data for first-time onboarding experience.
    const existingCustomers = await prisma.customer.count({ where: { organizationId, deletedAt: null } });
    if (existingCustomers > 0) return;

    const customer = await prisma.customer.create({
        data: {
            organizationId,
            name: "Sample Customer LLC",
            email: `sample-customer-${organizationId.slice(0, 6)}@example.com`,
            city: "Dubai",
            country: "AE",
            currency: "AED",
            defaultPaymentTerms: 30,
            isVatRegistered: true,
            trn: "300000000000999",
        },
    });

    const product = await prisma.product.create({
        data: {
            organizationId,
            sku: `SAMPLE-${organizationId.slice(0, 4).toUpperCase()}`,
            name: "Consulting Services",
            description: "Sample service line item",
            type: "SERVICE",
            unitPrice: 1000,
            currency: "AED",
            isActive: true,
        },
    });

    const subtotal = 1000;
    const vat = 50;
    const total = 1050;

    await prisma.invoice.create({
        data: {
            organizationId,
            customerId: customer.id,
            invoiceNumber: "INV-0001",
            invoiceType: "TAX_INVOICE",
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: "SENT",
            currency: "AED",
            subtotal,
            totalVat: vat,
            discount: 0,
            total,
            amountPaid: 0,
            outstanding: total,
            ftaCompliant: false,
            lineItems: {
                create: [
                    {
                        productId: product.id,
                        description: "Consulting Services",
                        quantity: 1,
                        unitPrice: subtotal,
                        unitOfMeasure: "unit",
                        discount: 0,
                        vatTreatment: "STANDARD_RATED",
                        vatRate: 5,
                        subtotal,
                        vatAmount: vat,
                        total,
                        sortOrder: 0,
                    },
                ],
            },
        },
    });

    await prisma.documentSequence.updateMany({
        where: { organizationId, documentType: "INVOICE", nextSequence: { lte: 1 } },
        data: { nextSequence: 2 },
    });
}
