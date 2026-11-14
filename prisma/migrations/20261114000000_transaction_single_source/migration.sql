-- A transaction's money comes from exactly one place: an account, or a
-- credit card (debt) for purchases on credit. Only expenses can be charged
-- to a debt. Prisma can't express CHECK constraints in schema.prisma, so
-- they live only here; app/dashboard/transactions/schemas.ts validates the
-- same rules before reaching the database.
ALTER TABLE "Transaction"
  ADD CONSTRAINT "transaction_single_source"
    CHECK (("accountId" IS NULL) <> ("debtId" IS NULL)),
  ADD CONSTRAINT "transaction_debt_is_expense"
    CHECK ("debtId" IS NULL OR type = 'expense');
