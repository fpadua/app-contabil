-- CreateTable
CREATE TABLE "Calculation" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'Correção monetária',
    "clientId" UUID,
    "processId" UUID,
    "indexSlug" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "principalInCents" INTEGER NOT NULL,
    "accumulatedFactor" DECIMAL(20,14) NOT NULL,
    "correctedInCents" INTEGER NOT NULL,
    "correctionInCents" INTEGER NOT NULL,
    "traceabilityRuleId" TEXT NOT NULL DEFAULT 'REGRA-CM-001',
    "months" JSONB,
    "status" TEXT NOT NULL DEFAULT 'Concluído',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Calculation_clientId_idx" ON "Calculation"("clientId");

-- CreateIndex
CREATE INDEX "Calculation_processId_idx" ON "Calculation"("processId");

-- CreateIndex
CREATE INDEX "Calculation_indexSlug_idx" ON "Calculation"("indexSlug");

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;