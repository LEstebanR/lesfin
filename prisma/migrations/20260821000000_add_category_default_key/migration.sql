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

CREATE UNIQUE INDEX "Category_userId_defaultKey_key" ON "Category"("userId", "defaultKey");
