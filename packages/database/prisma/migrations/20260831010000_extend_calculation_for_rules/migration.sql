-- AlterTable: novos motores (SAC/PRICE/salário/judicial) usam colunas genéricas.
ALTER TABLE "Calculation" ALTER COLUMN "indexSlug" DROP NOT NULL;
ALTER TABLE "Calculation" ALTER COLUMN "accumulatedFactor" DROP NOT NULL;
ALTER TABLE "Calculation" ALTER COLUMN "correctedInCents" DROP NOT NULL;
ALTER TABLE "Calculation" ALTER COLUMN "correctionInCents" DROP NOT NULL;
ALTER TABLE "Calculation" ADD COLUMN "installments" JSONB;
ALTER TABLE "Calculation" ADD COLUMN "params" JSONB;