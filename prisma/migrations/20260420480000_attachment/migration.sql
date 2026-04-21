-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" "AttachmentEntityType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "storageBucket" TEXT,
    "uploadedBy" TEXT,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT,
    "quotationId" TEXT,
    "creditNoteId" TEXT,
    "debitNoteId" TEXT,
    "billId" TEXT,
    "expenseId" TEXT,
    "deliveryNoteId" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_organizationId_entityType_idx" ON "Attachment"("organizationId", "entityType");

-- CreateIndex
CREATE INDEX "Attachment_invoiceId_idx" ON "Attachment"("invoiceId");

-- CreateIndex
CREATE INDEX "Attachment_quotationId_idx" ON "Attachment"("quotationId");

-- CreateIndex
CREATE INDEX "Attachment_creditNoteId_idx" ON "Attachment"("creditNoteId");

-- CreateIndex
CREATE INDEX "Attachment_debitNoteId_idx" ON "Attachment"("debitNoteId");

-- CreateIndex
CREATE INDEX "Attachment_billId_idx" ON "Attachment"("billId");

-- CreateIndex
CREATE INDEX "Attachment_expenseId_idx" ON "Attachment"("expenseId");

-- CreateIndex
CREATE INDEX "Attachment_deliveryNoteId_idx" ON "Attachment"("deliveryNoteId");
