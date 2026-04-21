-- CreateTable
CREATE TABLE "CreditNoteLineItem" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'unit',
    "vatTreatment" "VatTreatment" NOT NULL DEFAULT 'STANDARD_RATED',
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "vatAmount" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "CreditNoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditNoteLineItem_creditNoteId_idx" ON "CreditNoteLineItem"("creditNoteId");
