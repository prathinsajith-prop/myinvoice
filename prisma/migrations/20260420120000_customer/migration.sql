-- CreateTable
CREATE TABLE "Customer" (
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
    "image" TEXT,
    "trn" TEXT,
    "isVatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "unitNumber" TEXT,
    "buildingName" TEXT,
    "street" TEXT,
    "area" TEXT,
    "city" TEXT,
    "emirate" TEXT,
    "country" TEXT NOT NULL DEFAULT 'AE',
    "postalCode" TEXT,
    "poBox" TEXT,
    "shippingUnitNumber" TEXT,
    "shippingBuildingName" TEXT,
    "shippingStreet" TEXT,
    "shippingArea" TEXT,
    "shippingCity" TEXT,
    "shippingEmirate" TEXT,
    "shippingCountry" TEXT,
    "shippingPostalCode" TEXT,
    "defaultPaymentTerms" INTEGER,
    "creditLimit" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "defaultVatTreatment" "VatTreatment" NOT NULL DEFAULT 'STANDARD_RATED',
    "totalInvoiced" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalOutstanding" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "lastInvoiceDate" TIMESTAMP(3),
    "notes" TEXT,
    "tags" TEXT[],
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "portalToken" TEXT,
    "portalPassword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_portalToken_key" ON "Customer"("portalToken");

-- CreateIndex
CREATE INDEX "Customer_organizationId_name_idx" ON "Customer"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Customer_organizationId_trn_idx" ON "Customer"("organizationId", "trn");

-- CreateIndex
CREATE INDEX "Customer_organizationId_isActive_idx" ON "Customer"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Customer_organizationId_createdAt_idx" ON "Customer"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_portalToken_idx" ON "Customer"("portalToken");

-- CreateIndex
CREATE INDEX "Customer_organizationId_deletedAt_name_idx" ON "Customer"("organizationId", "deletedAt", "name");

-- CreateIndex
CREATE INDEX "Customer_organizationId_deletedAt_isActive_idx" ON "Customer"("organizationId", "deletedAt", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_email_key" ON "Customer"("organizationId", "email");
