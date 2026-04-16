import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, ForbiddenError, NotFoundError } from "@/lib/errors";

// GET /api/organizations/:id — get a specific organization the user belongs to
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const ctx = await resolveRouteContext(req);
    const { orgId } = await params;

    // Verify the requesting user is actually a member
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId: ctx.userId, organizationId: orgId },
      },
      select: { role: true, isActive: true },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenError("You do not belong to this organization");
    }

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        website: true,
        trn: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        emirate: true,
        country: true,
        postalCode: true,
        logo: true,
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
      },
    });

    if (!organization) throw new NotFoundError("Organization");

    return NextResponse.json({ ...organization, role: membership.role });
  } catch (error) {
    return toErrorResponse(error);
  }
}
