-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
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

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_organizationId_customerId_idx" ON "Payment"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_paymentDate_idx" ON "Payment"("organizationId", "paymentDate");

-- CreateIndex
CREATE INDEX "Payment_organizationId_status_idx" ON "Payment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organizationId_paymentNumber_key" ON "Payment"("organizationId", "paymentNumber");
