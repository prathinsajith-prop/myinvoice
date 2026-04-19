import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { updatePasswordSchema } from "@/lib/validations/settings";
import { resolveUserContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

// PATCH /api/user/password
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await resolveUserContext(req);
    const body = await req.json();

    const result = updatePasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = result.data;

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { password: true },
    });

    if (!user?.password) {
      return NextResponse.json(
        { error: "Password change is not available for OAuth accounts" },
        { status: 400 }
      );
    }

    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const hashed = await hash(newPassword, 12);
    await prisma.user.update({
      where: { id: ctx.userId },
      data: { password: hashed },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
