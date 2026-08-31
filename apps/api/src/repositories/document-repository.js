import { prisma } from "@contabil/database";

export class DocumentRepository {
  constructor(database = prisma) {
    this.database = database;
  }

  list() {
    return this.database.document.findMany({
      orderBy: { createdAt: "desc" },
      include: { process: { select: { id: true, title: true } } },
    });
  }

  findById(id) {
    return this.database.document.findUnique({
      where: { id },
      include: { process: { select: { id: true, title: true } } },
    });
  }

  create(data) {
    return this.database.document.create({ data });
  }

  update(id, data) {
    return this.database.document.update({ where: { id }, data });
  }

  remove(id) {
    return this.database.document.delete({ where: { id } });
  }
}