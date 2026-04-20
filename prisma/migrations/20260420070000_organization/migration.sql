-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "trn" TEXT,
    "tradeLicense" TEXT,
    "legalName" TEXT,
    "businessType" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "emirate" TEXT,
    "country" TEXT NOT NULL DEFAULT 'AE',
    "postalCode" TEXT,
    "poBox" TEXT,
    "logo" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'AED',
    "fiscalYearStart" INTEGER NOT NULL DEFAULT 1,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "proformaPrefix" TEXT NOT NULL DEFAULT 'PI',
    "quotePrefix" TEXT NOT NULL DEFAULT 'QT',
    "creditNotePrefix" TEXT NOT NULL DEFAULT 'CN',
    "debitNotePrefix" TEXT NOT NULL DEFAULT 'DN',
    "billPrefix" TEXT NOT NULL DEFAULT 'BILL',
    "expensePrefix" TEXT NOT NULL DEFAULT 'EXP',
    "paymentPrefix" TEXT NOT NULL DEFAULT 'PAY',
    "deliveryNotePrefix" TEXT NOT NULL DEFAULT 'DN',
    "defaultPaymentTerms" INTEGER NOT NULL DEFAULT 30,
    "defaultDueDateDays" INTEGER NOT NULL DEFAULT 30,
    "defaultVatRate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "defaultNotes" TEXT,
    "defaultTerms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_trn_idx" ON "Organization"("trn");
