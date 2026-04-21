-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "vatTreatment" "VatTreatment" NOT NULL DEFAULT 'STANDARD_RATED',
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "type" "ProductType" NOT NULL DEFAULT 'SERVICE',
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'unit',
    "category" TEXT,
    "trackInventory" BOOLEAN NOT NULL DEFAULT false,
    "stockQuantity" DECIMAL(10,2),
    "lowStockAlert" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_organizationId_name_idx" ON "Product"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Product_organizationId_type_idx" ON "Product"("organizationId", "type");

-- CreateIndex
CREATE INDEX "Product_organizationId_category_idx" ON "Product"("organizationId", "category");

-- CreateIndex
CREATE INDEX "Product_organizationId_isActive_idx" ON "Product"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Product_organizationId_deletedAt_isActive_name_idx" ON "Product"("organizationId", "deletedAt", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");
