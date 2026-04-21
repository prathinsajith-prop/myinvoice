-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "invitedEmail" TEXT,
    "invitedBy" TEXT,
    "inviteToken" TEXT,
    "inviteStatus" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_inviteToken_key" ON "OrganizationMembership"("inviteToken");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_inviteToken_idx" ON "OrganizationMembership"("inviteToken");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_role_idx" ON "OrganizationMembership"("organizationId", "role");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_isActive_idx" ON "OrganizationMembership"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_inviteStatus_idx" ON "OrganizationMembership"("organizationId", "inviteStatus");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_isActive_idx" ON "OrganizationMembership"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");
