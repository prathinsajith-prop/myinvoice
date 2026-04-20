-- CreateTable
CREATE TABLE "DocumentRelation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentType" "DocumentType" NOT NULL,
    "parentId" TEXT NOT NULL,
    "childType" "DocumentType" NOT NULL,
    "childId" TEXT NOT NULL,
    "relationType" "DocumentRelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRelation_organizationId_idx" ON "DocumentRelation"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentRelation_parentType_parentId_idx" ON "DocumentRelation"("parentType", "parentId");

-- CreateIndex
CREATE INDEX "DocumentRelation_childType_childId_idx" ON "DocumentRelation"("childType", "childId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRelation_parentId_childId_relationType_key" ON "DocumentRelation"("parentId", "childId", "relationType");
