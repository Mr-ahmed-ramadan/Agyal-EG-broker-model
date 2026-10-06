-- Awareness campaign: intent, never identity. Platform-level (no tenantId, no RLS).

-- CreateTable
CREATE TABLE "WaitlistSignup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "mobile" TEXT,
    "governorate" TEXT,
    "amountBand" TEXT,
    "savesIn" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "consent" BOOLEAN NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "campaign" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculatorUse" (
    "id" BIGSERIAL NOT NULL,
    "amountBand" TEXT NOT NULL,
    "tenorDays" INTEGER NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalculatorUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistSignup_createdAt_idx" ON "WaitlistSignup"("createdAt");

-- CreateIndex
CREATE INDEX "CalculatorUse_createdAt_idx" ON "CalculatorUse"("createdAt");
