-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
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

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditNote_organizationId_customerId_idx" ON "CreditNote"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "CreditNote_organizationId_invoiceId_idx" ON "CreditNote"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "CreditNote_organizationId_status_idx" ON "CreditNote"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CreditNote_organizationId_issueDate_idx" ON "CreditNote"("organizationId", "issueDate");

-- CreateIndex
CREATE INDEX "CreditNote_organizationId_deletedAt_status_issueDate_idx" ON "CreditNote"("organizationId", "deletedAt", "status", "issueDate");

-- CreateIndex
CREATE INDEX "CreditNote_customerId_idx" ON "CreditNote"("customerId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_organizationId_creditNoteNumber_key" ON "CreditNote"("organizationId", "creditNoteNumber");
