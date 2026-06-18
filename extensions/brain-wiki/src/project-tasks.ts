export interface ProjectTaskRecord {
  id: string;
  status: "open" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high";
  created: string;
  due?: string;
  owner?: string;
  depends_on: string[];
  links: string[];
  summary: string;
}

export function appendTaskBlock(markdown: string, task: ProjectTaskRecord): string {
  const block = [
    `### ${task.id}`,
    `- status: ${task.status}`,
    `- priority: ${task.priority}`,
    `- created: ${task.created}`,
    ...(task.due ? [`- due: ${task.due}`] : []),
    ...(task.owner ? [`- owner: ${task.owner}`] : []),
    `- depends_on: ${task.depends_on.length ? "" : "[]"}`,
    ...task.depends_on.map((item) => `  - ${item}`),
    `- links: ${task.links.length ? "" : "[]"}`,
    ...task.links.map((item) => `  - ${item}`),
    `- summary: ${task.summary}`,
    "",
  ].join("\n");
  return `${markdown.trimEnd()}\n\n${block}`;
}
