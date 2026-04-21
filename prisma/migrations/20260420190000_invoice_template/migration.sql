-- CreateTable
CREATE TABLE "InvoiceTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateKey" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "primaryColor" TEXT NOT NULL DEFAULT '#2563EB',
    "secondaryColor" TEXT NOT NULL DEFAULT '#64748B',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "logoPosition" TEXT NOT NULL DEFAULT 'left',
    "isRtl" BOOLEAN NOT NULL DEFAULT false,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "showQrCode" BOOLEAN NOT NULL DEFAULT true,
    "showBankDetails" BOOLEAN NOT NULL DEFAULT false,
    "showSignature" BOOLEAN NOT NULL DEFAULT false,
    "showStamp" BOOLEAN NOT NULL DEFAULT false,
    "showWatermark" BOOLEAN NOT NULL DEFAULT false,
    "watermarkText" TEXT,
    "layoutConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceTemplate_organizationId_idx" ON "InvoiceTemplate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceTemplate_organizationId_name_key" ON "InvoiceTemplate"("organizationId", "name");
