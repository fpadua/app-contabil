import { prisma } from "@contabil/database";

export class ClientRepository {
  constructor(database = prisma) {
    this.database = database;
  }

  list() {
    return this.database.client.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { processes: true } } },
    });
  }

  findById(id) {
    return this.database.client.findUnique({
      where: { id },
      include: { _count: { select: { processes: true } } },
    });
  }

  listOptions() {
    return this.database.client.findMany({
      where: { status: "Ativo" },
      select: { id: true, name: true, personType: true },
      orderBy: { name: "asc" },
    });
  }

  create(data) {
    return this.database.client.create({ data });
  }

  update(id, data) {
    return this.database.client.update({ where: { id }, data });
  }

  remove(id) {
    return this.database.client.delete({ where: { id } });
  }
}