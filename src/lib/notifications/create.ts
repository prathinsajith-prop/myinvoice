import prisma from "@/lib/db/prisma";

interface CreateNotificationParams {
    userId: string;
    title: string;
    message: string;
    type: string;
    organizationId?: string;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
}

/**
 * Create a notification for a single user.
 */
export async function createNotification(params: CreateNotificationParams) {
    return prisma.notification.create({
        data: {
            userId: params.userId,
            title: params.title,
            message: params.message,
            type: params.type as never,
            organizationId: params.organizationId,
            entityType: params.entityType,
            entityId: params.entityId,
            actionUrl: params.actionUrl,
        },
    });
}

/**
 * Notify all members of an organization (optionally excluding a user).
 */
export async function notifyOrgMembers(params: {
    organizationId: string;
    excludeUserId?: string;
    title: string;
    message: string;
    type: string;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
}) {
    const members = await prisma.organizationMembership.findMany({
        where: {
            organizationId: params.organizationId,
            inviteStatus: "ACCEPTED",
            ...(params.excludeUserId ? { userId: { not: params.excludeUserId } } : {}),
        },
        select: { userId: true },
    });

    if (members.length === 0) return;

    return prisma.notification.createMany({
        data: members.map((m) => ({
            userId: m.userId,
            title: params.title,
            message: params.message,
            type: params.type as never,
            organizationId: params.organizationId,
            entityType: params.entityType,
            entityId: params.entityId,
            actionUrl: params.actionUrl,
        })),
    });
}
