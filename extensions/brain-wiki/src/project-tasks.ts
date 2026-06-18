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

export function parseTaskBlocks(markdown: string): ProjectTaskRecord[] {
  const sections = markdown.split(/^### /m).slice(1);
  return sections.map((section) => {
    const lines = `### ${section}`.trim().split("\n");
    const id = lines[0].replace(/^###\s+/, "").trim();
    const record: ProjectTaskRecord = {
      id,
      status: "open",
      priority: "medium",
      created: "",
      depends_on: [],
      links: [],
      summary: "",
    };
    let activeList: "depends_on" | "links" | null = null;
    for (const line of lines.slice(1)) {
      if (line.startsWith("- status:")) {
        record.status = line.replace("- status:", "").trim() as ProjectTaskRecord["status"];
        activeList = null;
      } else if (line.startsWith("- priority:")) {
        record.priority = line.replace("- priority:", "").trim() as ProjectTaskRecord["priority"];
        activeList = null;
      } else if (line.startsWith("- created:")) {
        record.created = line.replace("- created:", "").trim();
        activeList = null;
      } else if (line.startsWith("- due:")) {
        record.due = line.replace("- due:", "").trim();
        activeList = null;
      } else if (line.startsWith("- owner:")) {
        record.owner = line.replace("- owner:", "").trim();
        activeList = null;
      } else if (line.startsWith("- depends_on:")) {
        const value = line.replace("- depends_on:", "").trim();
        record.depends_on = value === "[]" || value === "" ? [] : [value];
        activeList = "depends_on";
      } else if (line.startsWith("- links:")) {
        const value = line.replace("- links:", "").trim();
        record.links = value === "[]" || value === "" ? [] : [value];
        activeList = "links";
      } else if (line.startsWith("- summary:")) {
        record.summary = line.replace("- summary:", "").trim();
        activeList = null;
      } else if (line.startsWith("  - ") && activeList) {
        record[activeList].push(line.replace("  - ", "").trim());
      }
    }
    return record;
  });
}

export function nextTaskId(markdown: string): string {
  const tasks = parseTaskBlocks(markdown);
  const highest = tasks.reduce((max, task) => {
    const match = task.id.match(/^TASK-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `TASK-${String(highest + 1).padStart(3, "0")}`;
}

export function renderTaskBlock(task: ProjectTaskRecord): string {
  return [
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
}

export function appendTaskBlock(markdown: string, task: ProjectTaskRecord): string {
  return `${markdown.trimEnd()}\n\n${renderTaskBlock(task)}`;
}

export function updateTaskBlock(
  markdown: string,
  taskId: string,
  updater: (task: ProjectTaskRecord) => ProjectTaskRecord,
): string {
  const tasks = parseTaskBlocks(markdown);
  const target = tasks.find((task) => task.id === taskId);
  if (!target) throw new Error(`task not found: ${taskId}`);
  const updated = updater(target);
  return markdown.replace(
    new RegExp(`^### ${taskId}[\\s\\S]*?(?=^### TASK-\\d+|$)`, "m"),
    `${renderTaskBlock(updated)}\n`,
  ).replace(/\n{3,}/g, "\n\n");
}
