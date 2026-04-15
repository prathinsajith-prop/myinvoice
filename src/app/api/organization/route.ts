import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import prisma from "@/lib/db/prisma";
import { updateOrganizationSchema } from "@/lib/validations/settings";
import {
  resolveApiContext,
  resolveApiContextWithRole,
} from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { logAudit } from "@/lib/tenant/server";

const ORG_SELECT = {
  id: true,
  name: true,
  slug: true,
  email: true,
  phone: true,
  website: true,
  trn: true,
  tradeLicense: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  emirate: true,
  country: true,
  postalCode: true,
  logo: true,
  primaryColor: true,
  secondaryColor: true,
  defaultCurrency: true,
  fiscalYearStart: true,
  invoicePrefix: true,
  proformaPrefix: true,
  quotePrefix: true,
  creditNotePrefix: true,
  debitNotePrefix: true,
  billPrefix: true,
  paymentPrefix: true,
  defaultPaymentTerms: true,
  defaultDueDateDays: true,
  defaultVatRate: true,
  defaultNotes: true,
  defaultTerms: true,
  isActive: true,
  createdAt: true,
  subscription: {
    select: {
      plan: true,
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      monthlyInvoiceLimit: true,
      teamMemberLimit: true,
      storageGbLimit: true,
      customersLimit: true,
      hasApiAccess: true,
      hasCustomBranding: true,
      hasAdvancedReports: true,
      hasMultiCurrency: true,
      hasWhiteLabel: true,
    },
  },
} as const;

// GET /api/organization — get current organization
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);

    const organization = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: ORG_SELECT,
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ organization, role: ctx.role });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(200),
  legalName: z.string().min(2).max(200).optional(),
  businessType: z.string().optional(),
  country: z.string().length(2).optional().default("AE"),
  emirate: z.string().optional(),
  city: z.string().optional(),
  addressLine1: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  defaultCurrency: z.string().optional().default("AED"),
  trn: z
    .string()
    .length(15)
    .regex(/^\d+$/)
    .optional(),
  timezone: z.string().optional().default("Asia/Dubai"),
});

// POST /api/organization — create a new organization for the current user
export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);
    const body = await req.json();

    const result = createOrganizationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { timezone, ...orgData } = result.data;

    // Generate a unique slug from name
    const baseSlug = orgData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    const suffix = crypto.randomBytes(3).toString("hex").slice(0, 5);
    const slug = `${baseSlug}-${suffix}`;

    const DOCUMENT_SEQUENCES = [
      { documentType: "INVOICE" as const, prefix: "INV", nextSequence: 1, padLength: 4 },
      { documentType: "PROFORMA" as const, prefix: "PI", nextSequence: 1, padLength: 4 },
      { documentType: "QUOTATION" as const, prefix: "QT", nextSequence: 1, padLength: 4 },
      { documentType: "CREDIT_NOTE" as const, prefix: "CN", nextSequence: 1, padLength: 4 },
      { documentType: "DEBIT_NOTE" as const, prefix: "DN", nextSequence: 1, padLength: 4 },
      { documentType: "BILL" as const, prefix: "BILL", nextSequence: 1, padLength: 4 },
    ];

    const organization = await prisma.organization.create({
      data: {
        ...orgData,
        slug,
        legalName: orgData.legalName ?? orgData.name,
        defaultCurrency: orgData.defaultCurrency ?? "AED",
        defaultVatRate: orgData.country === "AE" ? 5 : 0,
        invoicePrefix: "INV",
        proformaPrefix: "PI",
        quotePrefix: "QT",
        creditNotePrefix: "CN",
        debitNotePrefix: "DN",
        billPrefix: "BILL",
        paymentPrefix: "PAY",
        defaultPaymentTerms: 30,
        memberships: {
          create: {
            userId: ctx.userId,
            role: "OWNER",
            inviteStatus: "ACCEPTED",
            acceptedAt: new Date(),
            isActive: true,
          },
        },
        subscription: {
          create: {
            plan: "FREE",
            status: "ACTIVE",
            monthlyInvoiceLimit: 10,
            teamMemberLimit: 1,
            storageGbLimit: 1,
            customersLimit: 50,
            hasApiAccess: false,
            hasCustomBranding: false,
            hasAdvancedReports: false,
            hasMultiCurrency: false,
            hasWhiteLabel: false,
          },
        },
        settings: {
          create: {
            timezone: timezone ?? "Asia/Dubai",
            vatRegistered: orgData.country === "AE",
            showLogo: true,
            showQrCode: true,
            autoReminders: true,
          },
        },
        documentSequences: {
          create: DOCUMENT_SEQUENCES,
        },
      },
      select: ORG_SELECT,
    });

    return NextResponse.json({ organization, role: "OWNER" }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// PATCH /api/organization — update current organization (ADMIN+)
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await resolveApiContextWithRole(req, "ADMIN");
    const body = await req.json();

    const result = updateOrganizationSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    // Capture previous state for audit
    const previous = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: ORG_SELECT,
    });

    const data = result.data;

    const organization = await prisma.$transaction(async (tx) => {
      const updatedOrg = await tx.organization.update({
        where: { id: ctx.organizationId },
        data,
        select: ORG_SELECT,
      });

      const prefixUpdates: Array<{ documentType: "INVOICE" | "PROFORMA" | "QUOTATION" | "CREDIT_NOTE" | "DEBIT_NOTE" | "BILL"; prefix?: string }> = [
        { documentType: "INVOICE", prefix: data.invoicePrefix },
        { documentType: "PROFORMA", prefix: data.proformaPrefix },
        { documentType: "QUOTATION", prefix: data.quotePrefix },
        { documentType: "CREDIT_NOTE", prefix: data.creditNotePrefix },
        { documentType: "DEBIT_NOTE", prefix: data.debitNotePrefix },
        { documentType: "BILL", prefix: data.billPrefix },
      ];

      await Promise.all(
        prefixUpdates
          .filter((p) => typeof p.prefix === "string" && p.prefix.trim().length > 0)
          .map((p) =>
            tx.documentSequence.updateMany({
              where: { organizationId: ctx.organizationId, documentType: p.documentType },
              data: { prefix: p.prefix!.trim().toUpperCase() },
            })
          )
      );

      return updatedOrg;
    });

    // Sync prefix changes to DocumentSequence rows
    const PREFIX_MAP = [
      ["invoicePrefix", "INVOICE"],
      ["proformaPrefix", "PROFORMA"],
      ["quotePrefix", "QUOTATION"],
      ["creditNotePrefix", "CREDIT_NOTE"],
      ["debitNotePrefix", "DEBIT_NOTE"],
      ["billPrefix", "BILL"],
      ["paymentPrefix", "PAYMENT"],
    ] as const;

    const prefixUpdates = PREFIX_MAP.filter(([field]) => result.data[field] !== undefined).map(
      ([field, documentType]) =>
        prisma.documentSequence.updateMany({
          where: { organizationId: ctx.organizationId, documentType: documentType as never },
          data: { prefix: result.data[field] as string },
        })
    );
    if (prefixUpdates.length > 0) await Promise.all(prefixUpdates);

    await logAudit({
      action: "UPDATE",
      entityType: "Organization",
      entityId: ctx.organizationId,
      previousData: previous,
      newData: organization,
    });

    return NextResponse.json(organization);
  } catch (error) {
    return toErrorResponse(error);
  }
}
