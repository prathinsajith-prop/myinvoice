import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
]);

export async function POST(req: NextRequest) {
    try {
        await resolveRouteContext(req);

        const form = await req.formData();
        const file = form.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json(
                { error: "Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, PDF" },
                { status: 400 }
            );
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 });
        }

        const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
        const safeExt = String(ext || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        const fileName = `receipt-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${safeExt}`;

        const uploadDir = path.join(process.cwd(), "public", "uploads", "receipts");
        await mkdir(uploadDir, { recursive: true });

        const bytes = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(uploadDir, fileName), bytes);

        return NextResponse.json({ url: `/uploads/receipts/${fileName}` });
    } catch (error) {
        return toErrorResponse(error);
    }
}
