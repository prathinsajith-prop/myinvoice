-- CreateEnum
CREATE TYPE "PdfTemplate" AS ENUM ('CLASSIC', 'MODERN', 'MINIMAL');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "pdfTemplate" "PdfTemplate" NOT NULL DEFAULT 'CLASSIC';
