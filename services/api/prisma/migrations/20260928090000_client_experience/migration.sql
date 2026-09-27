-- CreateTable
CREATE TABLE "IndicativeRate" (
    "isin" TEXT NOT NULL,
    "offerYield" DECIMAL(9,6),
    "bidYield" DECIMAL(9,6),
    "source" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicativeRate_pkey" PRIMARY KEY ("isin")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_tenantId_publishedAt_idx" ON "Announcement"("tenantId", "publishedAt");


-- Row-Level Security (ADR 0002): brokers read platform news (tenantId NULL) and
-- their own; only the platform (bypass) writes platform news.
ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Announcement"
  USING ("tenantId" IS NULL
         OR "tenantId" = current_setting('app.tenant_id', true)
         OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)
         OR current_setting('app.bypass_rls', true) = 'on');
