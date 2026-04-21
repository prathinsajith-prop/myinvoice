-- CreateTable
CREATE TABLE "BillVersion" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedBy" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillVersion_billId_idx" ON "BillVersion"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "BillVersion_billId_version_key" ON "BillVersion"("billId", "version");
