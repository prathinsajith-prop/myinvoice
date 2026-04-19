/**
 * External API module registry.
 *
 * Maps URL module slugs (e.g. "invoices") to Prisma model delegates,
 * list select fields, search columns, and default sort.
 *
 * Used by the catch-all route  /api/ext/[appId]/[...path]
 */

import prisma from "@/lib/db/prisma";

/* ---------- helpers -------- */

type PrismaDelegate = {
    findMany: (args: any) => Promise<any[]>;
    findFirst: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
};

export interface ModuleConfig {
    /** Prisma model delegate, e.g. prisma.invoice */
    delegate: PrismaDelegate;
    /** Fields to return in list queries */
    listSelect: Record<string, any>;
    /** Fields to return in single-record queries (null = use listSelect) */
    detailSelect?: Record<string, any> | null;
    /** Columns that support text search */
    searchColumns: string[];
    /** Default ORDER BY */
    orderBy: Record<string, string>;
    /** Whether the model uses soft-delete (deletedAt field) */
    softDelete: boolean;
}

/* ---------- per-module configs -------- */

const MODULES: Record<string, ModuleConfig> = {
    invoices: {
        delegate: prisma.invoice as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            invoiceNumber: true,
            invoiceType: true,
            status: true,
            issueDate: true,
            dueDate: true,
            currency: true,
            subtotal: true,
            totalVat: true,
            total: true,
            outstanding: true,
            amountPaid: true,
            reference: true,
            customer: { select: { id: true, name: true, email: true } },
        },
        searchColumns: ["invoiceNumber", "reference"],
        orderBy: { issueDate: "desc" },
        softDelete: true,
    },

    customers: {
        delegate: prisma.customer as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            name: true,
            email: true,
            phone: true,
            trn: true,
            currency: true,
            contactPerson: true,
            createdAt: true,
        },
        searchColumns: ["name", "email", "phone", "trn"],
        orderBy: { name: "asc" },
        softDelete: true,
    },

    suppliers: {
        delegate: prisma.supplier as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            name: true,
            email: true,
            phone: true,
            trn: true,
            currency: true,
            contactPerson: true,
            createdAt: true,
        },
        searchColumns: ["name", "email", "phone", "trn"],
        orderBy: { name: "asc" },
        softDelete: true,
    },

    products: {
        delegate: prisma.product as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            name: true,
            sku: true,
            type: true,
            unitPrice: true,
            currency: true,
            vatTreatment: true,
            vatRate: true,
            unitOfMeasure: true,
            isActive: true,
            createdAt: true,
        },
        searchColumns: ["name", "sku"],
        orderBy: { name: "asc" },
        softDelete: true,
    },

    quotations: {
        delegate: prisma.quotation as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            quoteNumber: true,
            status: true,
            issueDate: true,
            validUntil: true,
            currency: true,
            subtotal: true,
            totalVat: true,
            total: true,
            customer: { select: { id: true, name: true, email: true } },
        },
        searchColumns: ["quoteNumber"],
        orderBy: { issueDate: "desc" },
        softDelete: true,
    },

    "credit-notes": {
        delegate: prisma.creditNote as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            creditNoteNumber: true,
            status: true,
            issueDate: true,
            currency: true,
            subtotal: true,
            totalVat: true,
            total: true,
            reason: true,
            customer: { select: { id: true, name: true } },
        },
        searchColumns: ["creditNoteNumber"],
        orderBy: { issueDate: "desc" },
        softDelete: true,
    },

    "debit-notes": {
        delegate: prisma.debitNote as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            debitNoteNumber: true,
            status: true,
            issueDate: true,
            currency: true,
            subtotal: true,
            totalVat: true,
            total: true,
            reason: true,
            customer: { select: { id: true, name: true } },
        },
        searchColumns: ["debitNoteNumber"],
        orderBy: { issueDate: "desc" },
        softDelete: true,
    },

    "delivery-notes": {
        delegate: prisma.deliveryNote as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            deliveryNoteNumber: true,
            status: true,
            issueDate: true,
            deliveryDate: true,
            customer: { select: { id: true, name: true } },
        },
        searchColumns: ["deliveryNoteNumber"],
        orderBy: { issueDate: "desc" },
        softDelete: true,
    },

    bills: {
        delegate: prisma.bill as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            billNumber: true,
            status: true,
            issueDate: true,
            dueDate: true,
            currency: true,
            subtotal: true,
            totalVat: true,
            total: true,
            outstanding: true,
            supplier: { select: { id: true, name: true } },
        },
        searchColumns: ["billNumber"],
        orderBy: { issueDate: "desc" },
        softDelete: true,
    },

    "purchase-orders": {
        delegate: prisma.purchaseOrder as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            poNumber: true,
            status: true,
            issueDate: true,
            expectedDate: true,
            currency: true,
            subtotal: true,
            totalVat: true,
            total: true,
            supplier: { select: { id: true, name: true } },
        },
        searchColumns: ["poNumber"],
        orderBy: { issueDate: "desc" },
        softDelete: true,
    },

    expenses: {
        delegate: prisma.expense as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            description: true,
            category: true,
            amount: true,
            currency: true,
            expenseDate: true,
            vatAmount: true,
            isPaid: true,
            merchantName: true,
            createdAt: true,
        },
        searchColumns: ["description", "merchantName", "category"],
        orderBy: { expenseDate: "desc" },
        softDelete: true,
    },

    payments: {
        delegate: prisma.payment as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            paymentNumber: true,
            amount: true,
            currency: true,
            paymentDate: true,
            method: true,
            reference: true,
            customer: { select: { id: true, name: true } },
        },
        searchColumns: ["paymentNumber", "reference"],
        orderBy: { paymentDate: "desc" },
        softDelete: false,
    },

    "recurring-invoices": {
        delegate: prisma.recurringInvoice as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            templateName: true,
            status: true,
            frequency: true,
            nextRunDate: true,
            lastRunDate: true,
            currency: true,
            subtotal: true,
            totalVat: true,
            total: true,
            customer: { select: { id: true, name: true } },
        },
        searchColumns: ["templateName"],
        orderBy: { nextRunDate: "asc" },
        softDelete: false,
    },

    "vat-returns": {
        delegate: prisma.vatReturn as unknown as PrismaDelegate,
        listSelect: {
            id: true,
            periodStart: true,
            periodEnd: true,
            status: true,
            standardRatedSales: true,
            standardRatedPurchases: true,
            outputVat: true,
            inputVat: true,
            netVat: true,
            filedAt: true,
        },
        searchColumns: [],
        orderBy: { periodStart: "desc" },
        softDelete: false,
    },
};

export function getModuleConfig(slug: string): ModuleConfig | null {
    return MODULES[slug] ?? null;
}

export function getAllModuleSlugs(): string[] {
    return Object.keys(MODULES);
}
