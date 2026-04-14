import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

// GET /api/notifications — list unread (or recent) notifications for user
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

    const where = {
      userId: ctx.userId,
      ...(unreadOnly ? { isRead: false } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: ctx.userId, isRead: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// PATCH /api/notifications — mark notifications as read
const patchNotificationsSchema = z.union([
  z.object({ markAll: z.literal(true) }),
  z.object({
    markAll: z.literal(false).optional(),
    notificationIds: z.array(z.string().cuid()).min(1).max(100),
  }),
]);

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);
    const body = await req.json();

    const result = patchNotificationsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    if ("markAll" in result.data && result.data.markAll) {
      await prisma.notification.updateMany({
        where: { userId: ctx.userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    const { notificationIds } = result.data as { notificationIds: string[] };

    await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, userId: ctx.userId },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
