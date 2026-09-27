-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "bankAmount" DECIMAL(20,2);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "settlementRef" TEXT;

-- AlterTable
ALTER TABLE "OtpChallenge" ADD COLUMN     "payload" JSONB;

-- CreateTable
CREATE TABLE "ClientBankAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "bankReference" TEXT,
    "rejectReason" TEXT,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientBankAccount_clientId_idx" ON "ClientBankAccount"("clientId");

-- CreateIndex
CREATE INDEX "Withdrawal_tenantId_status_idx" ON "Withdrawal"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "ClientBankAccount" ADD CONSTRAINT "ClientBankAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "ClientBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security for the new tenant tables (same policy as ADR 0002 / init migration)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ClientBankAccount', 'Withdrawal']
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
