-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "supplierInvoiceNumber" TEXT,
    "reference" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "receivedDate" TIMESTAMP(3),
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "totalVat" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "amountPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(15,2) NOT NULL,
    "supplierTrn" TEXT,
    "vatReclaimable" BOOLEAN NOT NULL DEFAULT true,
    "inputVatAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bill_organizationId_supplierId_idx" ON "Bill"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "Bill_organizationId_status_idx" ON "Bill"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Bill_organizationId_issueDate_idx" ON "Bill"("organizationId", "issueDate");

-- CreateIndex
CREATE INDEX "Bill_organizationId_dueDate_idx" ON "Bill"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "Bill_organizationId_status_dueDate_idx" ON "Bill"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Bill_organizationId_deletedAt_status_issueDate_idx" ON "Bill"("organizationId", "deletedAt", "status", "issueDate");

-- CreateIndex
CREATE INDEX "Bill_organizationId_deletedAt_dueDate_idx" ON "Bill"("organizationId", "deletedAt", "dueDate");

-- CreateIndex
CREATE INDEX "Bill_supplierId_idx" ON "Bill"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_organizationId_billNumber_key" ON "Bill"("organizationId", "billNumber");
