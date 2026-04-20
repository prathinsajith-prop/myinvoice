-- CreateTable
CREATE TABLE "ConnectedApp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "appSecret" TEXT NOT NULL,
    "status" "AppStatus" NOT NULL DEFAULT 'ACTIVE',
    "scopes" TEXT[],
    "ipWhitelist" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConnectedApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectedApp_organizationId_idx" ON "ConnectedApp"("organizationId");

-- CreateIndex
CREATE INDEX "ConnectedApp_organizationId_status_idx" ON "ConnectedApp"("organizationId", "status");
