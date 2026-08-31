import { prisma } from "@contabil/database";

export class ProcessRepository {
  constructor(database = prisma) {
    this.database = database;
  }

  list() {
    return this.database.process.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: { select: { id: true, name: true } } },
    });
  }

  findById(id) {
    return this.database.process.findUnique({
      where: { id },
      include: { client: { select: { id: true, name: true } } },
    });
  }

  listOptions() {
    return this.database.process.findMany({
      select: { id: true, title: true, number: true, clientId: true },
      orderBy: { createdAt: "desc" },
    });
  }

  create(data) {
    return this.database.process.create({ data });
  }

  update(id, data) {
    return this.database.process.update({ where: { id }, data });
  }

  remove(id) {
    return this.database.process.delete({ where: { id } });
  }
}