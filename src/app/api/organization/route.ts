import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/db/prisma";
import { updateOrganizationSchema } from "@/lib/validations/settings";

// GET /api/organization - Get current organization
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token?.sub || !token?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: token.organizationId as string },
      select: {
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
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 }
    );
  }
}

// PATCH /api/organization - Update organization
export async function PATCH(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token?.sub || !token?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to update org
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: token.sub,
          organizationId: token.organizationId as string,
        },
      },
      select: { role: true },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { error: "You don't have permission to update organization settings" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = updateOrganizationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.update({
      where: { id: token.organizationId as string },
      data: result.data,
      select: {
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
      },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}
