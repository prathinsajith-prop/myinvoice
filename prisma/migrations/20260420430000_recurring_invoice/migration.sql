-- CreateTable
CREATE TABLE "RecurringInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "templateName" TEXT,
    "frequency" "RecurringFrequency" NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "lastRunDate" TIMESTAMP(3),
    "occurrencesLeft" INTEGER,
    "invoiceType" TEXT NOT NULL DEFAULT 'TAX_INVOICE',
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "terms" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalVat" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "autoSend" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
    "invoicesGenerated" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringInvoice_organizationId_status_idx" ON "RecurringInvoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RecurringInvoice_organizationId_nextRunDate_idx" ON "RecurringInvoice"("organizationId", "nextRunDate");

-- CreateIndex
CREATE INDEX "RecurringInvoice_customerId_idx" ON "RecurringInvoice"("customerId");

-- CreateIndex
CREATE INDEX "RecurringInvoice_organizationId_deletedAt_status_idx" ON "RecurringInvoice"("organizationId", "deletedAt", "status");

-- CreateIndex
CREATE INDEX "RecurringInvoice_organizationId_deletedAt_createdAt_idx" ON "RecurringInvoice"("organizationId", "deletedAt", "createdAt");
