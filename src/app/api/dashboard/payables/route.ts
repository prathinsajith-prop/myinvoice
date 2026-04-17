import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        // Fetch unpaid bills
        const unpaidBills = await prisma.bill.findMany({
            where: {
                organizationId: ctx.organizationId,
                deletedAt: null,
                status: {
                    not: "PAID",
                },
            },
            select: {
                id: true,
                billNumber: true,
                dueDate: true,
                total: true,
                outstanding: true,
                status: true,
                supplier: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                dueDate: "asc",
            },
        });

        // Categorize by urgency
        const categorized = {
            overdue: unpaidBills.filter((b) => b.dueDate < today),
            dueSoon: unpaidBills.filter((b) => b.dueDate >= today && b.dueDate < sevenDaysFromNow),
            future: unpaidBills.filter((b) => b.dueDate >= sevenDaysFromNow),
        };

        // Calculate totals
        const totals = {
            overdue: categorized.overdue.reduce((sum, b) => sum + Number(b.outstanding), 0),
            dueSoon: categorized.dueSoon.reduce((sum, b) => sum + Number(b.outstanding), 0),
            future: categorized.future.reduce((sum, b) => sum + Number(b.outstanding), 0),
            total: unpaidBills.reduce((sum, b) => sum + Number(b.outstanding), 0),
        };

        return NextResponse.json({
            overdue: categorized.overdue,
            dueSoon: categorized.dueSoon,
            future: categorized.future,
            totals,
            count: {
                overdue: categorized.overdue.length,
                dueSoon: categorized.dueSoon.length,
                future: categorized.future.length,
                total: unpaidBills.length,
            },
        });
    } catch (error) {
        console.error("[Dashboard Payables API]", error);
        return toErrorResponse(error);
    }
}
