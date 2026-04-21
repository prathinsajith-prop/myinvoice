-- CreateTable
CREATE TABLE "InvoiceVersion" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedBy" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceVersion_invoiceId_idx" ON "InvoiceVersion"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceVersion_invoiceId_version_key" ON "InvoiceVersion"("invoiceId", "version");
