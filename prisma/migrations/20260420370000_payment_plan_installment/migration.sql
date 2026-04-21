-- CreateTable
CREATE TABLE "PaymentPlanInstallment" (
    "id" TEXT NOT NULL,
    "paymentPlanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(15,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPlanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentPlanInstallment_paymentPlanId_idx" ON "PaymentPlanInstallment"("paymentPlanId");

-- CreateIndex
CREATE INDEX "PaymentPlanInstallment_dueDate_isPaid_idx" ON "PaymentPlanInstallment"("dueDate", "isPaid");
