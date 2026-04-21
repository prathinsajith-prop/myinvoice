-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'BUSINESS',
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "contactPerson" TEXT,
    "website" TEXT,
    "trn" TEXT,
    "isVatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "emirate" TEXT,
    "country" TEXT NOT NULL DEFAULT 'AE',
    "postalCode" TEXT,
    "poBox" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIban" TEXT,
    "bankSwift" TEXT,
    "bankBranch" TEXT,
    "defaultPaymentTerms" INTEGER NOT NULL DEFAULT 30,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "totalBilled" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalOutstanding" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "billCount" INTEGER NOT NULL DEFAULT 0,
    "lastBillDate" TIMESTAMP(3),
    "notes" TEXT,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_organizationId_name_idx" ON "Supplier"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_trn_idx" ON "Supplier"("organizationId", "trn");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_isActive_idx" ON "Supplier"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_createdAt_idx" ON "Supplier"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_deletedAt_name_idx" ON "Supplier"("organizationId", "deletedAt", "name");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_deletedAt_isActive_idx" ON "Supplier"("organizationId", "deletedAt", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_organizationId_email_key" ON "Supplier"("organizationId", "email");
