import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { updateProfileSchema } from "@/lib/validations/settings";
import { resolveUserContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

// GET /api/user/profile
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveUserContext(req);

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        twoFactorEnabled: true,
        emailNotifications: true,
        pushNotifications: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return toErrorResponse(error);
  }
}

// PATCH /api/user/profile
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await resolveUserContext(req);
    const body = await req.json();

    const result = updateProfileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: ctx.userId },
      data: result.data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        twoFactorEnabled: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    return toErrorResponse(error);
  }
}
