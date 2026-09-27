-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" TEXT NOT NULL,
    "docKey" TEXT NOT NULL,
    "recipient" TEXT,
    "token" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentOpen" (
    "id" BIGSERIAL NOT NULL,
    "linkId" TEXT NOT NULL,
    "docKey" TEXT NOT NULL,
    "recipient" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "lang" TEXT,
    "referrer" TEXT,

    CONSTRAINT "DocumentOpen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLink_token_key" ON "DocumentLink"("token");

-- CreateIndex
CREATE INDEX "DocumentLink_docKey_idx" ON "DocumentLink"("docKey");

-- CreateIndex
CREATE INDEX "DocumentOpen_docKey_openedAt_idx" ON "DocumentOpen"("docKey", "openedAt");

-- CreateIndex
CREATE INDEX "DocumentOpen_linkId_idx" ON "DocumentOpen"("linkId");

-- AddForeignKey
ALTER TABLE "DocumentOpen" ADD CONSTRAINT "DocumentOpen_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "DocumentLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Link creation and revocation are part of the audit trail; opens have their own log.
CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON "DocumentLink" FOR EACH ROW EXECUTE FUNCTION audit_row_change();
