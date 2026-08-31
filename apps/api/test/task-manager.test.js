import assert from "node:assert/strict";
import test from "node:test";
import { createTask, updateTask, setTaskRunning, finishTask, getTask, listTasks } from "../src/services/task-manager.js";

test("cria, atualiza, finaliza e consulta uma tarefa com progresso", () => {
  const task = createTask({ type: "index-refresh", label: "Atualizar ipca" });
  assert.equal(task.status, "QUEUED");
  assert.equal(task.progress, 0);

  setTaskRunning(task.id);
  assert.equal(getTask(task.id).status, "RUNNING");

  updateTask(task.id, { progress: 45, message: "Coletando séries" });
  assert.equal(getTask(task.id).progress, 45);
  assert.equal(getTask(task.id).message, "Coletando séries");

  finishTask(task.id, { result: { status: "SUCCEEDED", inserted: 2 } });
  const done = getTask(task.id);
  assert.equal(done.status, "SUCCEEDED");
  assert.equal(done.progress, 100);
  assert.equal(done.result.inserted, 2);
});

test("finaliza como FAILED quando recebe erro", () => {
  const task = createTask({ type: "index-import", label: "Importar PDF" });
  finishTask(task.id, { status: "FAILED", error: "arquivo inválido" });
  const done = getTask(task.id);
  assert.equal(done.status, "FAILED");
  assert.equal(done.error, "arquivo inválido");
});

test("listTasks nunca expõe result e lista várias tarefas", () => {
  const a = createTask({ type: "t", label: "a" });
  const b = createTask({ type: "t", label: "b" });
  finishTask(a.id, { result: { secret: true } });
  const list = listTasks({ limit: 10 });
  const labels = list.map((task) => task.label);
  assert.ok(labels.includes("a"));
  assert.ok(labels.includes("b"));
  assert.equal("result" in list[0], false);
});
