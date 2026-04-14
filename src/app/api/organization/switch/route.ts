import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, ForbiddenError, ValidationError } from "@/lib/errors";

const switchSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
});

/**
 * POST /api/organization/switch
 * Validates the user belongs to the target org, then returns the new org data.
 * The client calls session.update({ organizationId }) to refresh the JWT;
 * this endpoint provides server-side validation of that switch.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);
    const body = await req.json();

    const result = switchSchema.safeParse(body);
    if (!result.success) {
      throw new ValidationError("Invalid request", result.error.flatten());
    }

    const { organizationId } = result.data;

    // Verify user is an active member of the target org
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId: ctx.userId, organizationId },
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenError("You do not belong to this organization");
    }

    if (!membership.organization.isActive) {
      throw new ForbiddenError("This organization is inactive");
    }

    return NextResponse.json({
      organizationId: membership.organization.id,
      organizationSlug: membership.organization.slug,
      organizationName: membership.organization.name,
      role: membership.role,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
