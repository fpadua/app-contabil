import { prisma } from "@contabil/database";

export class CalculationRepository {
  constructor(database = prisma) {
    this.database = database;
  }

  list(filters = {}) {
    return this.database.calculation.findMany({
      where: {
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.processId ? { processId: filters.processId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        process: { select: { id: true, title: true, number: true } },
      },
    });
  }

  findById(id) {
    return this.database.calculation.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        process: { select: { id: true, title: true, number: true } },
      },
    });
  }

  create(data) {
    return this.database.calculation.create({ data });
  }

  update(id, data) {
    return this.database.calculation.update({ where: { id }, data });
  }

  remove(id) {
    return this.database.calculation.delete({ where: { id } });
  }
}