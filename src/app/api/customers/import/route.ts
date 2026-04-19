import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithPermission } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";

// Each CSV row is validated against this schema — all fields except name are optional.
const rowSchema = z.object({
    name: z.string().min(1, "Name is required"),
    displayName: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    mobile: z.string().optional(),
    contactPerson: z.string().optional(),
    type: z.enum(["BUSINESS", "INDIVIDUAL"]).default("BUSINESS"),
    trn: z.string().optional(),
    isVatRegistered: z
        .string()
        .optional()
        .transform((v) => v === "true" || v === "1" || v === "yes"),
    city: z.string().optional(),
    emirate: z.string().optional(),
    country: z.string().optional(),
    currency: z.string().default("AED"),
    defaultPaymentTerms: z
        .string()
        .optional()
        .transform((v) => (v && !isNaN(Number(v)) ? Number(v) : undefined)),
    notes: z.string().optional(),
});

type CsvRow = z.input<typeof rowSchema>;

function parseCsv(text: string): CsvRow[] {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (lines.length < 2) return [];

    // Normalise header names: lowercase, strip whitespace
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Basic CSV parse — handles quoted fields with commas inside
        const values: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of line) {
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === "," && !inQuotes) {
                values.push(current.trim());
                current = "";
            } else {
                current += ch;
            }
        }
        values.push(current.trim());

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] ?? "";
        });
        rows.push(row as CsvRow);
    }
    return rows;
}

/**
 * POST /api/customers/import
 * Body: multipart/form-data with a "file" field (CSV)
 *
 * Returns: { imported, skipped, errors[] }
 */
export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "create");

        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || typeof file === "string") {
            return NextResponse.json(
                { error: "No CSV file provided", code: "VALIDATION_ERROR" },
                { status: 400 },
            );
        }

        const text = await (file as File).text();
        const rawRows = parseCsv(text);

        if (rawRows.length === 0) {
            return NextResponse.json(
                { error: "CSV file is empty or has no data rows", code: "VALIDATION_ERROR" },
                { status: 400 },
            );
        }

        if (rawRows.length > 500) {
            return NextResponse.json(
                { error: "CSV file exceeds 500 row limit per import", code: "VALIDATION_ERROR" },
                { status: 400 },
            );
        }

        // Fetch existing emails for this org to detect duplicates
        const existingEmails = new Set(
            (
                await prisma.customer.findMany({
                    where: { organizationId: ctx.organizationId, deletedAt: null, email: { not: null } },
                    select: { email: true },
                })
            ).map((c) => c.email!.toLowerCase()),
        );

        const toCreate: Parameters<typeof prisma.customer.createMany>[0]["data"] = [];
        const errors: { row: number; message: string }[] = [];
        let skipped = 0;

        for (let i = 0; i < rawRows.length; i++) {
            const result = rowSchema.safeParse(rawRows[i]);
            if (!result.success) {
                errors.push({
                    row: i + 2, // +2 = 1-indexed + header row
                    message: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
                });
                continue;
            }

            const data = result.data;

            // Skip duplicate emails
            if (data.email && existingEmails.has(data.email.toLowerCase())) {
                skipped++;
                continue;
            }

            toCreate.push({
                organizationId: ctx.organizationId,
                name: data.name,
                displayName: data.displayName || null,
                email: data.email || null,
                phone: data.phone || null,
                mobile: data.mobile || null,
                contactPerson: data.contactPerson || null,
                type: data.type,
                trn: data.trn || null,
                isVatRegistered: data.isVatRegistered ?? false,
                city: data.city || null,
                emirate: data.emirate || null,
                country: data.country || "AE",
                currency: data.currency || "AED",
                defaultPaymentTerms: data.defaultPaymentTerms ?? null,
                notes: data.notes || null,
            });

            if (data.email) existingEmails.add(data.email.toLowerCase());
        }

        let imported = 0;
        if (toCreate.length > 0) {
            const result = await prisma.customer.createMany({ data: toCreate, skipDuplicates: true });
            imported = result.count;
        }

        logApiAudit({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            action: "CREATE",
            entityType: "customer",
            entityId: ctx.organizationId,
            newData: { importedCount: imported, skippedCount: skipped },
        });

        return NextResponse.json({ imported, skipped, errors });
    } catch (err) {
        return toErrorResponse(err);
    }
}
