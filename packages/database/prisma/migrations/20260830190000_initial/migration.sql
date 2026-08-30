-- CreateEnum
CREATE TYPE "IndexSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "EconomicIndex" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "periodicity" TEXT NOT NULL DEFAULT 'MONTHLY',
    "basis" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicIndexValue" (
    "id" UUID NOT NULL,
    "economicIndexId" UUID NOT NULL,
    "referenceDate" DATE NOT NULL,
    "monthlyValue" DECIMAL(18,10),
    "accumulatedValue" DECIMAL(24,12),
    "accumulatedPositive" DECIMAL(24,12),
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrl" TEXT,
    "rawData" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicIndexValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicIndexValueHistory" (
    "id" UUID NOT NULL,
    "economicIndexId" UUID NOT NULL,
    "referenceDate" DATE NOT NULL,
    "previousMonthlyValue" DECIMAL(18,10),
    "newMonthlyValue" DECIMAL(18,10),
    "previousAccumulatedValue" DECIMAL(24,12),
    "newAccumulatedValue" DECIMAL(24,12),
    "previousPublished" BOOLEAN,
    "newPublished" BOOLEAN NOT NULL,
    "syncRunId" UUID,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomicIndexValueHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicIndexSyncRun" (
    "id" UUID NOT NULL,
    "status" "IndexSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "source" TEXT NOT NULL,
    "requestedBy" TEXT,
    "fromPeriod" TEXT,
    "toPeriod" TEXT,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "EconomicIndexSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceFile" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCells" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalculationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EconomicIndex_slug_key" ON "EconomicIndex"("slug");

-- CreateIndex
CREATE INDEX "EconomicIndexValue_referenceDate_idx" ON "EconomicIndexValue"("referenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicIndexValue_economicIndexId_referenceDate_key" ON "EconomicIndexValue"("economicIndexId", "referenceDate");

-- CreateIndex
CREATE INDEX "EconomicIndexValueHistory_economicIndexId_referenceDate_idx" ON "EconomicIndexValueHistory"("economicIndexId", "referenceDate");

-- CreateIndex
CREATE INDEX "EconomicIndexValueHistory_syncRunId_idx" ON "EconomicIndexValueHistory"("syncRunId");

-- AddForeignKey
ALTER TABLE "EconomicIndexValue" ADD CONSTRAINT "EconomicIndexValue_economicIndexId_fkey" FOREIGN KEY ("economicIndexId") REFERENCES "EconomicIndex"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomicIndexValueHistory" ADD CONSTRAINT "EconomicIndexValueHistory_economicIndexId_fkey" FOREIGN KEY ("economicIndexId") REFERENCES "EconomicIndex"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomicIndexValueHistory" ADD CONSTRAINT "EconomicIndexValueHistory_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "EconomicIndexSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
