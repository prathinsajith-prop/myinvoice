import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

// GET /api/organizations — list all organizations the current user belongs to
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);

    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: ctx.userId, isActive: true },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            isActive: true,
            createdAt: true,
            subscription: {
              select: {
                plan: true,
                status: true,
                trialEndsAt: true,
                currentPeriodEnd: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const organizations = memberships.map((m) => ({
      ...m.organization,
      role: m.role,
      membershipId: m.id,
      joinedAt: m.acceptedAt ?? m.createdAt,
      isCurrent: m.organization.id === ctx.organizationId,
    }));

    return NextResponse.json({ organizations });
  } catch (error) {
    return toErrorResponse(error);
  }
}
