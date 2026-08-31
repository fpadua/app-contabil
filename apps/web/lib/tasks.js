const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export async function fetchTaskList() {
  const response = await fetch(`${apiUrl}/api/tasks`);
  if (!response.ok) throw new Error("Não foi possível consultar as tarefas.");
  return response.json();
}
