import { getTask, listTasks } from "../services/task-manager.js";

export async function taskRoutes(app) {
  app.get("/", async (request) => {
    const limit = Number(request.query?.limit) || 20;
    return listTasks({ limit });
  });

  app.get("/:id", async (request, reply) => {
    const task = getTask(request.params.id);
    if (!task) return reply.status(404).send({ code: "TASK_NOT_FOUND", message: "Tarefa não encontrada." });
    return task;
  });
}
