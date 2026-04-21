-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "totalVat" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "terms" TEXT,
    "internalNotes" TEXT,
    "shippingAddress" TEXT,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "billId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_billId_key" ON "PurchaseOrder"("billId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_supplierId_idx" ON "PurchaseOrder"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_status_idx" ON "PurchaseOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_issueDate_idx" ON "PurchaseOrder"("organizationId", "issueDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_expectedDate_idx" ON "PurchaseOrder"("organizationId", "expectedDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_deletedAt_status_issueDate_idx" ON "PurchaseOrder"("organizationId", "deletedAt", "status", "issueDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_poNumber_key" ON "PurchaseOrder"("organizationId", "poNumber");
