import { PrismaClient } from "@prisma/client";

const globalDatabase = globalThis;

export const prisma = globalDatabase.contabilPrisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalDatabase.contabilPrisma = prisma;
