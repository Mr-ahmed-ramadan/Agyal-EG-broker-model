-- CreateTable
CREATE TABLE "ComplianceFlag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "brokerResponse" TEXT,
    "respondedById" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ComplianceFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceFlag_tenantId_status_idx" ON "ComplianceFlag"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ComplianceFlag_clientId_idx" ON "ComplianceFlag"("clientId");


-- Row-Level Security (ADR 0002): brokers see only their own flags; Agyal admin uses the platform bypass.
ALTER TABLE "ComplianceFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComplianceFlag" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ComplianceFlag"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');
