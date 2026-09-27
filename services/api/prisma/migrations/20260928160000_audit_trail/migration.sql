-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "outcome" INTEGER,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "DataChange" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tableName" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "rowId" TEXT,
    "tenantId" TEXT,
    "actorId" TEXT,
    "requestId" TEXT,
    "changes" JSONB NOT NULL,

    CONSTRAINT "DataChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataChange_tableName_rowId_idx" ON "DataChange"("tableName", "rowId");

-- CreateIndex
CREATE INDEX "DataChange_tenantId_at_idx" ON "DataChange"("tenantId", "at");

-- CreateIndex
CREATE INDEX "DataChange_actorId_at_idx" ON "DataChange"("actorId", "at");

-- CreateIndex
CREATE INDEX "DataChange_requestId_idx" ON "DataChange"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");


-- ---------------------------------------------------------------------------
-- Data-change trail: an AFTER trigger on every business table records the
-- change with the acting user (app.actor_id) and request (app.request_id)
-- that the API sets on each transaction. Secrets are redacted; logos (large
-- data URLs) are dropped from branding. High-volume/technical tables (FIX
-- messages and queues, OTP challenges, the audit tables) are not tracked.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_row_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  o jsonb;
  n jsonb;
  diff jsonb := '{}'::jsonb;
  k text;
  rid text;
  tid text;
  redact text[] := ARRAY['passwordHash', 'codeHash', 'nationalIdEncrypted'];
BEGIN
  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW); END IF;

  FOREACH k IN ARRAY redact LOOP
    IF o ? k AND o->>k IS NOT NULL THEN o := o || jsonb_build_object(k, '[redacted]'); END IF;
    IF n ? k AND n->>k IS NOT NULL THEN n := n || jsonb_build_object(k, '[redacted]'); END IF;
  END LOOP;
  IF o ? 'branding' AND jsonb_typeof(o->'branding') = 'object' THEN o := jsonb_set(o, '{branding}', (o->'branding') - 'logoUrl'); END IF;
  IF n ? 'branding' AND jsonb_typeof(n->'branding') = 'object' THEN n := jsonb_set(n, '{branding}', (n->'branding') - 'logoUrl'); END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(n) LOOP
      IF k <> 'updatedAt' AND (o->k) IS DISTINCT FROM (n->k) THEN
        diff := diff || jsonb_build_object(k, jsonb_build_object('from', o->k, 'to', n->k));
      END IF;
    END LOOP;
    IF diff = '{}'::jsonb THEN RETURN NULL; END IF;
  ELSIF TG_OP = 'INSERT' THEN
    diff := n;
  ELSE
    diff := o;
  END IF;

  rid := COALESCE(n->>'id', o->>'id', n->>'key', o->>'key', n->>'isin', o->>'isin');
  IF TG_TABLE_NAME = 'Tenant' THEN
    tid := rid;
  ELSE
    tid := COALESCE(n->>'tenantId', o->>'tenantId', NULLIF(current_setting('app.tenant_id', true), ''));
  END IF;

  INSERT INTO "DataChange" ("tableName", "op", "rowId", "tenantId", "actorId", "requestId", "changes")
  VALUES (TG_TABLE_NAME, TG_OP, rid, tid,
          NULLIF(current_setting('app.actor_id', true), ''),
          NULLIF(current_setting('app.request_id', true), ''),
          diff);
  RETURN NULL;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema()
      AND tablename NOT IN ('DataChange', 'AuditLog', 'FixMessage', 'FixInbox', 'FixOutbox', 'OtpChallenge', '_prisma_migrations')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON %I', t);
    EXECUTE format('CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t);
  END LOOP;
END $$;

-- Tenants see only their own changes; Agyal admin reads through the platform bypass. The trigger may always write.
ALTER TABLE "DataChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataChange" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DataChange"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (true);
