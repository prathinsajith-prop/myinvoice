import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, ForbiddenError, NotFoundError } from "@/lib/errors";

// GET /api/organizations/:id — get a specific organization the user belongs to
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const ctx = await resolveApiContext(req);
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
        plan: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!organization) throw new NotFoundError("Organization");

    return NextResponse.json({ ...organization, role: membership.role });
  } catch (error) {
    return toErrorResponse(error);
  }
}
