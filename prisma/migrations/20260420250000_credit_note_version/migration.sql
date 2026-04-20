-- CreateTable
CREATE TABLE "CreditNoteVersion" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedBy" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditNoteVersion_creditNoteId_idx" ON "CreditNoteVersion"("creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNoteVersion_creditNoteId_version_key" ON "CreditNoteVersion"("creditNoteId", "version");
