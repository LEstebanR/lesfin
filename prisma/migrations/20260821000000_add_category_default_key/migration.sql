ALTER TABLE "Category" ADD COLUMN "defaultKey" TEXT;

UPDATE "Category"
SET "defaultKey" = CASE "name"
  WHEN 'Alimentación' THEN 'food'
  WHEN 'Caridad' THEN 'charity'
  WHEN 'Deuda' THEN 'debt'
  WHEN 'Educación' THEN 'education'
  WHEN 'Entretenimiento' THEN 'entertainment'
  WHEN 'Familia' THEN 'family'
  WHEN 'Hogar' THEN 'home'
  WHEN 'Legal' THEN 'legal'
  WHEN 'Mascotas' THEN 'pets'
  WHEN 'Regalos' THEN 'gifts'
  WHEN 'Ropa' THEN 'clothing'
  WHEN 'Salud' THEN 'health'
  WHEN 'Servicios' THEN 'utilities'
  WHEN 'Transporte' THEN 'transport'
  WHEN 'Otros' THEN 'other'
  WHEN 'Salario' THEN 'salary'
  WHEN 'Freelance' THEN 'freelance'
  WHEN 'Inversiones' THEN 'investments'
  WHEN 'Reembolsos' THEN 'refunds'
  WHEN 'Regalos recibidos' THEN 'gifts-received'
  WHEN 'Otros ingresos' THEN 'other-income'
END
WHERE "isDefault" = true;

-- Some existing users may have duplicate default categories from before
-- defaultKey existed. Keep the oldest category as the canonical default and
-- preserve duplicate categories and their related records as custom ones.
WITH ranked_defaults AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "defaultKey"
      ORDER BY "createdAt", "id"
    ) AS row_number
  FROM "Category"
  WHERE "defaultKey" IS NOT NULL
)
UPDATE "Category" AS category
SET "defaultKey" = NULL,
    "isDefault" = false
FROM ranked_defaults
WHERE category."id" = ranked_defaults."id"
  AND ranked_defaults.row_number > 1;

CREATE UNIQUE INDEX "Category_userId_defaultKey_key" ON "Category"("userId", "defaultKey");
