-- CreateTable
CREATE TABLE "DeliveryNoteLineItem" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'unit',
    "notes" TEXT,

    CONSTRAINT "DeliveryNoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryNoteLineItem_deliveryNoteId_idx" ON "DeliveryNoteLineItem"("deliveryNoteId");
