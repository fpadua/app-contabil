const MAX_TASKS = 100;
const tasks = new Map();
let sequence = 0;

export function createTask({ type, label }) {
  if (tasks.size >= MAX_TASKS) {
    const oldest = [...tasks.keys()].sort((a, b) => tasks.get(a).createdAt - tasks.get(b).createdAt)[0];
    if (oldest) tasks.delete(oldest);
  }
  sequence += 1;
  const now = Date.now();
  const task = {
    id: `task_${now}_${sequence}`,
    type,
    label,
    status: "QUEUED",
    stage: null,
    message: "Aguardando início...",
    progress: 0,
    current: null,
    total: null,
    currentName: null,
    result: null,
    error: null,
    createdAt: now,
    startedAt: null,
    updatedAt: now,
    finishedAt: null,
  };
  tasks.set(task.id, task);
  return task;
}

export function setTaskRunning(id) {
  const task = tasks.get(id);
  if (!task) return;
  task.status = "RUNNING";
  task.startedAt = Date.now();
}

export function updateTask(id, patch) {
  const task = tasks.get(id);
  if (!task) return;
  task.stage = patch.stage ?? task.stage;
  task.message = patch.message ?? task.message;
  if (typeof patch.progress === "number") task.progress = Math.max(0, Math.min(100, Math.round(patch.progress)));
  if (Number.isInteger(patch.current)) task.current = patch.current;
  if (Number.isInteger(patch.total)) task.total = patch.total;
  if (patch.currentName !== undefined) task.currentName = patch.currentName;
  task.updatedAt = Date.now();
}

export function finishTask(id, { result, status, error }) {
  const task = tasks.get(id);
  if (!task) return;
  task.status = status ?? (error ? "FAILED" : result?.status ?? "SUCCEEDED");
  task.progress = task.status === "FAILED" ? task.progress : 100;
  task.error = error ?? null;
  task.result = result ?? null;
  task.finishedAt = Date.now();
  task.updatedAt = Date.now();
}

export function getTask(id) {
  const task = tasks.get(id);
  if (!task) return null;
  const { result, ...publicTask } = task;
  return { ...publicTask, result };
}

export function listTasks({ limit = 20 } = {}) {
  return [...tasks.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((task) => {
      const { result, ...publicTask } = task;
      return publicTask;
    });
}
