-- CreateTable
CREATE TABLE "PaymentOut" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "reference" TEXT,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "amount" DECIMAL(15,2) NOT NULL,
    "bankCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountNet" DECIMAL(15,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gatewayTransactionId" TEXT,
    "gatewayResponse" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentOut_organizationId_supplierId_idx" ON "PaymentOut"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "PaymentOut_organizationId_paymentDate_idx" ON "PaymentOut"("organizationId", "paymentDate");

-- CreateIndex
CREATE INDEX "PaymentOut_organizationId_status_idx" ON "PaymentOut"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PaymentOut_supplierId_idx" ON "PaymentOut"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOut_organizationId_paymentNumber_key" ON "PaymentOut"("organizationId", "paymentNumber");
