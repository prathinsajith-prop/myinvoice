import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveApiContextWithRole } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
]);

export async function POST(req: NextRequest) {
    try {
        await resolveApiContextWithRole(req, "ADMIN");

        const form = await req.formData();
        const file = form.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "File exceeds 2MB limit" }, { status: 400 });
        }

        const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
        const safeExt = String(ext || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        const fileName = `logo-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${safeExt}`;

        const uploadDir = path.join(process.cwd(), "public", "uploads", "logos");
        await mkdir(uploadDir, { recursive: true });

        const bytes = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(uploadDir, fileName), bytes);

        return NextResponse.json({ url: `/uploads/logos/${fileName}` });
    } catch (error) {
        return toErrorResponse(error);
    }
}
