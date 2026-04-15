import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

// GET /api/notifications — list notifications for user with pagination
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
    const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));

    const where = {
      userId: ctx.userId,
      ...(unreadOnly ? { isRead: false } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: ctx.userId, isRead: false },
      }),
    ]);

    return NextResponse.json({
      notifications,
      total,
      unreadCount,
      hasMore: offset + notifications.length < total,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// PATCH /api/notifications — mark notifications as read
const patchNotificationsSchema = z.union([
  z.object({ markAllRead: z.literal(true) }),
  z.object({
    markAllRead: z.literal(false).optional(),
    notificationIds: z.array(z.string()).min(1).max(100),
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

    if ("markAllRead" in result.data && result.data.markAllRead) {
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

// DELETE /api/notifications — delete notifications
const deleteNotificationsSchema = z.object({
  notificationIds: z.array(z.string()).min(1).max(100),
});

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);
    const body = await req.json();

    const result = deleteNotificationsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    await prisma.notification.deleteMany({
      where: {
        id: { in: result.data.notificationIds },
        userId: ctx.userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
