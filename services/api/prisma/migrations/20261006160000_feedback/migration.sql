-- Visitor feedback on the beta. Platform-level (no tenantId, no RLS), like Lead.
CREATE TABLE "Feedback" (
    "id" BIGSERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "source" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");
