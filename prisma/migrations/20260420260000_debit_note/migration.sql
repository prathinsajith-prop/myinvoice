-- CreateTable
CREATE TABLE "DebitNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "debitNoteNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "totalVat" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "sellerTrn" TEXT,
    "buyerTrn" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebitNote_organizationId_customerId_idx" ON "DebitNote"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "DebitNote_organizationId_invoiceId_idx" ON "DebitNote"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "DebitNote_organizationId_status_idx" ON "DebitNote"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DebitNote_organizationId_issueDate_idx" ON "DebitNote"("organizationId", "issueDate");

-- CreateIndex
CREATE INDEX "DebitNote_organizationId_deletedAt_status_issueDate_idx" ON "DebitNote"("organizationId", "deletedAt", "status", "issueDate");

-- CreateIndex
CREATE INDEX "DebitNote_customerId_idx" ON "DebitNote"("customerId");

-- CreateIndex
CREATE INDEX "DebitNote_invoiceId_idx" ON "DebitNote"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "DebitNote_organizationId_debitNoteNumber_key" ON "DebitNote"("organizationId", "debitNoteNumber");
