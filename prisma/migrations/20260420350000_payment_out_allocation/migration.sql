-- CreateTable
CREATE TABLE "PaymentOutAllocation" (
    "id" TEXT NOT NULL,
    "paymentOutId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentOutAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentOutAllocation_billId_idx" ON "PaymentOutAllocation"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOutAllocation_paymentOutId_billId_key" ON "PaymentOutAllocation"("paymentOutId", "billId");
