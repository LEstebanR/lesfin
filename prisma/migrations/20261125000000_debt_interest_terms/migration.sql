-- Interest terms on Debt (#12). The rate is a fraction (0.245 = 24.5%).
ALTER TABLE "Debt"
  ADD COLUMN "interestRate" DECIMAL(9,6),
  ADD COLUMN "interestRateType" TEXT,
  ADD COLUMN "accrualFrequency" TEXT;

-- Prisma can't express CHECK constraints in schema.prisma, so they live only
-- here; lib/debt-interest.ts validates the same rules before reaching the DB.
ALTER TABLE "Debt"
  ADD CONSTRAINT "debt_interest_rate_range"
    CHECK ("interestRate" IS NULL OR ("interestRate" >= 0 AND "interestRate" <= 10)),
  ADD CONSTRAINT "debt_interest_rate_type"
    CHECK ("interestRateType" IS NULL OR "interestRateType" IN ('effective_annual', 'nominal_annual', 'monthly')),
  ADD CONSTRAINT "debt_interest_rate_has_type"
    CHECK (("interestRate" IS NULL) = ("interestRateType" IS NULL)),
  ADD CONSTRAINT "debt_accrual_frequency"
    CHECK ("accrualFrequency" IS NULL OR "accrualFrequency" = 'monthly');

-- Accrual events: one per debt and period ('YYYY-MM'), with their source.
ALTER TABLE "DebtInterestCharge"
  ADD COLUMN "period" TEXT,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "DebtInterestCharge" SET "period" = to_char("date", 'YYYY-MM');

ALTER TABLE "DebtInterestCharge"
  ALTER COLUMN "period" SET NOT NULL,
  ADD CONSTRAINT "debt_interest_charge_source"
    CHECK ("source" IN ('manual', 'statement', 'estimated')),
  ADD CONSTRAINT "debt_interest_charge_positive"
    CHECK ("amount" > 0);

CREATE UNIQUE INDEX "DebtInterestCharge_debtId_period_key" ON "DebtInterestCharge"("debtId", "period");
