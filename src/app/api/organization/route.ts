import { NextRequest, NextResponse } from "next/server";
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
  defaultCurrency: true,
  fiscalYearStart: true,
  invoicePrefix: true,
  quotePrefix: true,
  defaultPaymentTerms: true,
  plan: true,
  planExpiresAt: true,
  isActive: true,
  createdAt: true,
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

    return NextResponse.json(organization);
  } catch (error) {
    return toErrorResponse(error);
  }
}

// POST /api/organization — create a new organization for the current user
export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);
    const body = await req.json();

    const result = updateOrganizationSchema
      .pick({ name: true })
      .required({ name: true })
      .safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { name } = result.data;

    // Generate a unique slug from name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    const suffix = Math.random().toString(36).slice(2, 7);
    const slug = `${baseSlug}-${suffix}`;

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        memberships: {
          create: {
            userId: ctx.userId,
            role: "OWNER",
            acceptedAt: new Date(),
          },
        },
      },
      select: ORG_SELECT,
    });

    return NextResponse.json(organization, { status: 201 });
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

    const organization = await prisma.organization.update({
      where: { id: ctx.organizationId },
      data: result.data,
      select: ORG_SELECT,
    });

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
