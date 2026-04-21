-- CreateTable
CREATE TABLE "VatReturn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "filedAt" TIMESTAMP(3),
    "standardRatedSales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "zeroRatedSales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "exemptSales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "standardRatedPurchases" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "outputVat" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "inputVat" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netVat" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "ftaReferenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VatReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VatReturn_organizationId_periodEnd_idx" ON "VatReturn"("organizationId", "periodEnd");

-- CreateIndex
CREATE INDEX "VatReturn_organizationId_status_idx" ON "VatReturn"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VatReturn_organizationId_periodStart_periodEnd_key" ON "VatReturn"("organizationId", "periodStart", "periodEnd");
