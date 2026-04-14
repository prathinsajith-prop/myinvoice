/**
 * Document Numbering Service
 * Generates sequential, gapless document numbers per organisation per type.
 * Uses a database-level atomic increment + SELECT FOR UPDATE to prevent duplicates.
 */

import prisma from "@/lib/db/prisma";
import { type DocumentType } from "@/generated/prisma";

export async function getNextDocumentNumber(
    organizationId: string,
    documentType: DocumentType
): Promise<string> {
    // Atomic increment using Prisma's $transaction with raw SQL
    const result = await prisma.$transaction(async (tx) => {
        // Lock the row for this org/type to prevent concurrent duplicates
        const seq = await tx.$queryRaw<{ prefix: string; next_sequence: number; pad_length: number }[]>`
      SELECT prefix, "nextSequence" as next_sequence, "padLength" as pad_length
      FROM "DocumentSequence"
      WHERE "organizationId" = ${organizationId}
        AND "documentType" = ${documentType}::"DocumentType"
      FOR UPDATE
    `;

        if (!seq.length) {
            throw new Error(`No document sequence found for ${documentType} in org ${organizationId}`);
        }

        const { prefix, next_sequence, pad_length } = seq[0];

        // Increment
        await tx.$executeRaw`
      UPDATE "DocumentSequence"
      SET "nextSequence" = "nextSequence" + 1, "updatedAt" = NOW()
      WHERE "organizationId" = ${organizationId}
        AND "documentType" = ${documentType}::"DocumentType"
    `;

        const paddedNumber = String(next_sequence).padStart(pad_length, "0");
        return `${prefix}-${paddedNumber}`;
    });

    return result;
}
