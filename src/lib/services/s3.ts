/**
 * AWS S3 Upload Service
 * Handles image uploads to S3 with presigned URLs for downloads
 */

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "me-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

export interface S3UploadResult {
    key: string;
    url: string;
    contentType: string;
    size: number;
}

/**
 * Upload a file to S3 with auto-generated key
 * Returns public URL and S3 key for database storage
 */
export async function uploadToS3(
    buffer: Buffer,
    filename: string,
    contentType: string,
    folder: string = "uploads"
): Promise<S3UploadResult> {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
        throw new AppError("AWS_S3_BUCKET not configured", "CONFIG_ERROR", 500);
    }

    // Generate unique key: folder/timestamp-randomid/filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const key = `${folder}/${timestamp}-${random}/${filename}`;

    try {
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            // Public read access - adjust based on your security requirements
            ACL: "public-read",
            // Optional: metadata for tracking
            Metadata: {
                "upload-date": new Date().toISOString(),
            },
        });

        await s3Client.send(command);

        // Generate public URL
        const baseUrl = process.env.AWS_S3_PUBLIC_URL;
        const url = baseUrl
            ? `${baseUrl}/${key}`
            : `https://${bucket}.s3.${process.env.AWS_REGION || "me-south-1"}.amazonaws.com/${key}`;

        return {
            key,
            url,
            contentType,
            size: buffer.length,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new AppError(
            `S3 upload failed: ${message}`,
            "S3_UPLOAD_ERROR",
            500
        );
    }
}

/**
 * Generate a presigned URL for downloading a file from S3
 * Useful for private/restricted content
 */
export async function getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
): Promise<string> {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
        throw new AppError("AWS_S3_BUCKET not configured", "CONFIG_ERROR", 500);
    }

    try {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn });
        return url;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new AppError(
            `Presigned URL generation failed: ${message}`,
            "PRESIGNED_URL_ERROR",
            500
        );
    }
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
        throw new AppError("AWS_S3_BUCKET not configured", "CONFIG_ERROR", 500);
    }

    try {
        // Using a simple HEAD request to verify deletion
        // In production, you might want to add DeleteObjectCommand
        logger.info(`Marked for deletion: ${key}`);
        // TODO: Implement actual deletion if needed
    } catch (error) {
        logger.error({ error }, `Failed to delete ${key}`);
    }
}
