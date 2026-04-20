-- CreateTable
CREATE TABLE "DebitNoteVersion" (
    "id" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedBy" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebitNoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebitNoteVersion_debitNoteId_idx" ON "DebitNoteVersion"("debitNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "DebitNoteVersion_debitNoteId_version_key" ON "DebitNoteVersion"("debitNoteId", "version");
