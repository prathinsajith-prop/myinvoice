-- CreateTable
CREATE TABLE "ApiRequestLog" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiRequestLog_appId_createdAt_idx" ON "ApiRequestLog"("appId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_appId_module_idx" ON "ApiRequestLog"("appId", "module");

-- CreateIndex
CREATE INDEX "ApiRequestLog_appId_statusCode_idx" ON "ApiRequestLog"("appId", "statusCode");

-- CreateIndex
CREATE INDEX "ApiRequestLog_appId_error_idx" ON "ApiRequestLog"("appId", "error");
