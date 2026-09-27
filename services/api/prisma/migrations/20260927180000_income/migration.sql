-- CreateTable
CREATE TABLE "IncomeEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "per100" DECIMAL(18,8) NOT NULL,
    "totalGross" DECIMAL(20,2) NOT NULL,
    "totalTax" DECIMAL(20,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeEntitlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nominal" DECIMAL(20,2) NOT NULL,
    "gross" DECIMAL(20,2) NOT NULL,
    "tax" DECIMAL(20,2) NOT NULL,
    "net" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "IncomeEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncomeEvent_tenantId_isin_type_paymentDate_key" ON "IncomeEvent"("tenantId", "isin", "type", "paymentDate");

-- CreateIndex
CREATE INDEX "IncomeEntitlement_clientId_idx" ON "IncomeEntitlement"("clientId");

-- AddForeignKey
ALTER TABLE "IncomeEntitlement" ADD CONSTRAINT "IncomeEntitlement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "IncomeEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeEntitlement" ADD CONSTRAINT "IncomeEntitlement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security for the new tenant tables (ADR 0002)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['IncomeEvent', 'IncomeEntitlement']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING ("tenantId" = current_setting(''app.tenant_id'', true)
                OR current_setting(''app.bypass_rls'', true) = ''on'')
         WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true)
                OR current_setting(''app.bypass_rls'', true) = ''on'')',
      t);
  END LOOP;
END $$;
