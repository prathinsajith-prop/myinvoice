-- CreateTable
CREATE TABLE "PaymentReminder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'EMAIL',
    "type" "ReminderType" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failReason" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "recipient" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentReminder_organizationId_status_idx" ON "PaymentReminder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PaymentReminder_invoiceId_idx" ON "PaymentReminder"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentReminder_scheduledAt_status_idx" ON "PaymentReminder"("scheduledAt", "status");
