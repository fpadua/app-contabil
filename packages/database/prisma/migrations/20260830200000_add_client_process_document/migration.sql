-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "personType" TEXT NOT NULL DEFAULT 'Pessoa física',
    "name" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Ativo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Process" (
    "id" UUID NOT NULL,
    "clientId" UUID,
    "title" TEXT NOT NULL,
    "number" TEXT,
    "calculationType" TEXT NOT NULL DEFAULT 'Correção monetária',
    "status" TEXT NOT NULL DEFAULT 'Em andamento',
    "court" TEXT,
    "division" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "storageKey" TEXT,
    "processId" UUID,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Em revisão',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Process_clientId_idx" ON "Process"("clientId");

-- CreateIndex
CREATE INDEX "Document_processId_idx" ON "Document"("processId");

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;