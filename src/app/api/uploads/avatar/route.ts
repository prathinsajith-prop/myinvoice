import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveUserContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
]);

/**
 * POST /api/uploads/avatar
 * Saves the uploaded image to public/uploads/avatars/ and returns a URL.
 * Requires an authenticated session (any role).
 */
export async function POST(req: NextRequest) {
    try {
        await resolveUserContext(req);

        const form = await req.formData();
        const file = form.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json({ error: "Unsupported file type. Use JPG, PNG, GIF, or WebP." }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "File exceeds 2 MB limit" }, { status: 400 });
        }

        const rawExt = file.name.includes(".") ? file.name.split(".").pop() : "png";
        const safeExt = String(rawExt || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        const fileName = `avatar-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${safeExt}`;

        const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
        await mkdir(uploadDir, { recursive: true });

        const bytes = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(uploadDir, fileName), bytes);

        return NextResponse.json({ url: `/uploads/avatars/${fileName}` });
    } catch (error) {
        return toErrorResponse(error);
    }
}
