-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ONBOARDING', 'PENDING_APPROVAL', 'NEEDS_INFO', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RiskRating" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskProfile" AS ENUM ('CONSERVATIVE', 'BALANCED', 'GROWTH');

-- CreateEnum
CREATE TYPE "InvestorCodeStatus" AS ENUM ('NOT_REQUESTED', 'EXISTING_DECLARED', 'REQUESTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Depository" AS ENUM ('MCDR', 'CBE', 'BANK_INTERNAL');

-- CreateEnum
CREATE TYPE "BankConnectionMode" AS ENUM ('FIX', 'PORTAL', 'FILE');

-- CreateEnum
CREATE TYPE "InstrumentType" AS ENUM ('TREASURY_BOND', 'TREASURY_BILL', 'CORPORATE_BOND', 'SUKUK');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalNameEn" TEXT NOT NULL,
    "legalNameAr" TEXT NOT NULL,
    "fraLicenseNo" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "customDomain" TEXT,
    "branding" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "passwordHash" TEXT NOT NULL,
    "roles" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "depositReference" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ONBOARDING',
    "fullNameEn" TEXT,
    "fullNameAr" TEXT,
    "nationalIdEncrypted" TEXT,
    "nationalIdLast4" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "riskRating" "RiskRating",
    "riskProfile" "RiskProfile",
    "kycApprovedAt" TIMESTAMP(3),
    "kycReviewDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "completed" TEXT[],
    "ekycResult" JSONB,
    "profile" JSONB,
    "amlResult" JSONB,
    "suitability" JSONB,
    "submittedAt" TIMESTAMP(3),
    "decisionBy" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "ip" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorCode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "code" TEXT,
    "status" "InvestorCodeStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "custodian" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "depository" "Depository" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "connectionMode" "BankConnectionMode" NOT NULL,
    "fixSenderCompId" TEXT,
    "fixTargetCompId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerBankRelationship" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "brokerAccountAtBank" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BrokerBankRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "type" "InstrumentType" NOT NULL,
    "issuer" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "couponRate" DECIMAL(9,6),
    "couponFreq" INTEGER,
    "issueDate" TIMESTAMP(3),
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "depository" "Depository" NOT NULL,
    "minQty" DECIMAL(20,2) NOT NULL,
    "qtyIncrement" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteReqId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "orderQty" DECIMAL(20,2) NOT NULL,
    "settlDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "priceType" TEXT NOT NULL,
    "offerPx" DECIMAL(18,8) NOT NULL,
    "offerYield" DECIMAL(9,6),
    "validUntil" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clOrdId" TEXT NOT NULL,
    "orderId" TEXT,
    "clientId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "ordType" TEXT NOT NULL,
    "orderQty" DECIMAL(20,2) NOT NULL,
    "ordStatus" TEXT NOT NULL,
    "cumQty" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "reservedAmount" DECIMAL(20,2) NOT NULL,
    "priceSnapshotId" TEXT NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "execId" TEXT NOT NULL,
    "execType" TEXT NOT NULL,
    "ordStatus" TEXT NOT NULL,
    "lastQty" DECIMAL(20,2),
    "lastPx" DECIMAL(18,8),
    "accruedInterestAmt" DECIMAL(20,2),
    "netMoney" DECIMAL(20,2),
    "clientAmount" DECIMAL(20,2),
    "settlDate" TIMESTAMP(3),
    "transactTime" TIMESTAMP(3) NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "pricingRule" JSONB NOT NULL,
    "bankCleanPx" DECIMAL(18,8) NOT NULL,
    "bankYield" DECIMAL(9,6),
    "markupBps" INTEGER NOT NULL,
    "clientCleanPx" DECIMAL(18,8) NOT NULL,
    "clientYield" DECIMAL(9,6),
    "accruedInterest" DECIMAL(20,2) NOT NULL,
    "principal" DECIMAL(20,2) NOT NULL,
    "commission" DECIMAL(20,2) NOT NULL,
    "totalCost" DECIMAL(20,2) NOT NULL,
    "settlDate" TIMESTAMP(3) NOT NULL,
    "disclosure" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixOutbox" (
    "id" BIGSERIAL NOT NULL,
    "bankId" TEXT NOT NULL,
    "senderCompId" TEXT NOT NULL,
    "targetCompId" TEXT NOT NULL,
    "msgType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "FixOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixInbox" (
    "id" BIGSERIAL NOT NULL,
    "senderCompId" TEXT NOT NULL,
    "msgType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "FixInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixMessage" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "msgType" TEXT NOT NULL,
    "seqNum" INTEGER NOT NULL,
    "raw" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "type" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "bankId" TEXT,
    "key" TEXT NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(24,2) NOT NULL,

    CONSTRAINT "Posting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");

-- CreateIndex
CREATE INDEX "Client_tenantId_status_idx" ON "Client"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_depositReference_key" ON "Client"("tenantId", "depositReference");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingApplication_clientId_key" ON "OnboardingApplication"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorCode_clientId_key" ON "InvestorCode"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CustodyAccount_clientId_depository_key" ON "CustodyAccount"("clientId", "depository");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_code_key" ON "Bank"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerBankRelationship_tenantId_bankId_key" ON "BrokerBankRelationship"("tenantId", "bankId");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_isin_key" ON "Instrument"("isin");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRequest_quoteReqId_key" ON "QuoteRequest"("quoteReqId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_bankId_quoteId_key" ON "Quote"("bankId", "quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_clOrdId_key" ON "Order"("clOrdId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_quoteId_key" ON "Order"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_priceSnapshotId_key" ON "Order"("priceSnapshotId");

-- CreateIndex
CREATE INDEX "Order_tenantId_ordStatus_idx" ON "Order"("tenantId", "ordStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Execution_bankId_execId_key" ON "Execution"("bankId", "execId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_key_key" ON "LedgerAccount"("key");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_eventType_reference_key" ON "JournalEntry"("tenantId", "eventType", "reference");

-- CreateIndex
CREATE INDEX "Posting_accountId_idx" ON "Posting"("accountId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entity_entityId_idx" ON "AuditLog"("tenantId", "entity", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingApplication" ADD CONSTRAINT "OnboardingApplication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorCode" ADD CONSTRAINT "InvestorCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyAccount" ADD CONSTRAINT "CustodyAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerBankRelationship" ADD CONSTRAINT "BrokerBankRelationship_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerBankRelationship" ADD CONSTRAINT "BrokerBankRelationship_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_priceSnapshotId_fkey" FOREIGN KEY ("priceSnapshotId") REFERENCES "PriceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Row-Level Security (ADR 0002)
--
-- Tenant-scoped tables are only visible when the transaction has set
-- app.tenant_id to the row's tenant, or app.bypass_rls = 'on' (platform jobs
-- such as the FIX inbox processor). FORCE applies the policies to the table
-- owner too, so the application role cannot bypass them by accident.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Client', 'OnboardingApplication', 'Consent', 'InvestorCode', 'CustodyAccount',
    'BrokerBankRelationship', 'QuoteRequest', 'Quote', 'Order', 'Execution',
    'PriceSnapshot', 'LedgerAccount', 'JournalEntry', 'Posting'
  ]
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
