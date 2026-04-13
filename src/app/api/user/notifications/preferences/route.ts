import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/db/prisma";
import { updateNotificationPreferencesSchema } from "@/lib/validations/settings";

// GET /api/user/notifications/preferences - Get notification preferences
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: {
        emailNotifications: true,
        pushNotifications: true,
        invoiceNotifications: true,
        paymentNotifications: true,
        reminderNotifications: true,
        marketingNotifications: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

// PATCH /api/user/notifications/preferences - Update notification preferences
export async function PATCH(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = updateNotificationPreferencesSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const preferences = await prisma.user.update({
      where: { id: token.sub },
      data: result.data,
      select: {
        emailNotifications: true,
        pushNotifications: true,
        invoiceNotifications: true,
        paymentNotifications: true,
        reminderNotifications: true,
        marketingNotifications: true,
      },
    });

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
