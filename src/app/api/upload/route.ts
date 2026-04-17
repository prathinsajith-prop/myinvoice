/**
 * POST /api/upload
 * Upload files to S3
 * 
 * Accepts: multipart/form-data with 'file' field
 * Returns: { url, key, contentType, size }
 * 
 * Environment variables required:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION (default: me-south-1)
 * - AWS_S3_BUCKET
 * - AWS_S3_PUBLIC_URL (optional: for CDN URLs)
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, ValidationError } from "@/lib/errors";
import { uploadToS3 } from "@/lib/services/s3";

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
];

export async function POST(req: NextRequest) {
    try {
        // Require authentication
        const _ctx = await resolveApiContext(req);

        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            throw new ValidationError("No file provided");
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new ValidationError(
                `File type not allowed. Accepted types: ${ALLOWED_TYPES.join(", ")}`
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            throw new ValidationError(
                `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`
            );
        }

        // Convert File to Buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Determine folder based on file type
        const folder = file.type.startsWith("image/")
            ? "images"
            : file.type === "application/pdf"
                ? "pdfs"
                : "documents";

        // Upload to S3
        const result = await uploadToS3(buffer, file.name, file.type, folder);

        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export const runtime = "nodejs";
export const maxDuration = 60; // 60 second timeout for upload
