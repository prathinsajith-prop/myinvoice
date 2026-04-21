-- CreateTable
CREATE TABLE "DeliveryNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "deliveryNoteNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDate" TIMESTAMP(3),
    "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "shippingAddress" TEXT,
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "driverName" TEXT,
    "vehicleNumber" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryNote_organizationId_customerId_idx" ON "DeliveryNote"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "DeliveryNote_organizationId_invoiceId_idx" ON "DeliveryNote"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "DeliveryNote_organizationId_status_idx" ON "DeliveryNote"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DeliveryNote_organizationId_issueDate_idx" ON "DeliveryNote"("organizationId", "issueDate");

-- CreateIndex
CREATE INDEX "DeliveryNote_organizationId_deletedAt_status_issueDate_idx" ON "DeliveryNote"("organizationId", "deletedAt", "status", "issueDate");

-- CreateIndex
CREATE INDEX "DeliveryNote_customerId_idx" ON "DeliveryNote"("customerId");

-- CreateIndex
CREATE INDEX "DeliveryNote_invoiceId_idx" ON "DeliveryNote"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryNote_organizationId_deliveryNoteNumber_key" ON "DeliveryNote"("organizationId", "deliveryNoteNumber");
