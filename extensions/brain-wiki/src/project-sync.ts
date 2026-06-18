import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import matter from "gray-matter";
import { appendMarkdown, readMarkdown, serializeMarkdownPage, toObsidianPath, writeMarkdown } from "./obsidian-io.ts";
import { buildProjectTemplate } from "./project-schema.ts";
import type { ProjectStatus } from "./project-schema.ts";
import { formatTimelineEntry } from "./project-timeline.ts";
import { appendTaskBlock, nextTaskId, parseTaskBlocks, updateTaskBlock } from "./project-tasks.ts";
import { projectRoot, listMdPath } from "./paths.ts";
import type { ProjectSyncAction, ProjectSyncResult } from "./types.ts";
import type { ObsidianClient } from "./obsidian-client.ts";

const AI_INDICATOR = "> 🤖 [AI]";
const PROJECTS_CONTROL_FILE = "PROJECTS.md";
const PROJECT_MAIN_CANDIDATES = ["index.md", "PROJECT.md", "README.md"];

export async function syncProject(
  root: string,
  action: ProjectSyncAction,
  project?: string,
  content?: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  const projRoot = projectRoot(root);

  switch (action) {
    case "scan":
      return scanProjects(projRoot, client);
    case "create_project":
      if (!project) throw new Error("project required for create_project");
      return createProject(projRoot, project, client);
    case "add_note":
      if (!project || !content) throw new Error("project and content required for add_note");
      return addProjectNote(projRoot, project, content, client);
    case "suggest_task":
      if (!content) throw new Error("content required for suggest_task");
      return suggestTask(root, content, client);
    case "review":
      return reviewProjects(projRoot, client);
    case "set_status":
      if (!project || !content) throw new Error("project and content required for set_status");
      return setProjectStatus(projRoot, project, content, client);
    case "set_next_action":
      if (!project || !content) throw new Error("project and content required for set_next_action");
      return setProjectNextAction(projRoot, project, content, client);
    case "set_deadline":
      if (!project || !content) throw new Error("project and content required for set_deadline");
      return setProjectDeadline(projRoot, project, content, client);
    case "link_resource":
      if (!project || !content) throw new Error("project and content required for link_resource");
      return linkProjectResource(projRoot, project, content, client);
    case "relate":
      if (!project || !content) throw new Error("project and content required for relate");
      return relateProject(projRoot, project, content, client);
    case "timeline_append":
      if (!project || !content) throw new Error("project and content required for timeline_append");
      return appendProjectTimeline(projRoot, project, content, client);
    case "task_add":
      if (!project || !content) throw new Error("project and content required for task_add");
      return addProjectTask(projRoot, project, content, client);
    case "task_update":
      if (!project || !content) throw new Error("project and content required for task_update");
      return updateProjectTask(projRoot, project, content, client);
    case "task_block":
      if (!project || !content) throw new Error("project and content required for task_block");
      return blockProjectTask(projRoot, project, content, client);
    case "task_close":
      if (!project || !content) throw new Error("project and content required for task_close");
      return closeProjectTask(projRoot, project, content, client);
    case "task_promote":
      if (!project || !content) throw new Error("project and content required for task_promote");
      return promoteProjectTask(root, projRoot, project, content, client);
    default:
      throw new Error(`Unknown project sync action: ${action}`);
  }
}

async function scanProjects(projRoot: string, client?: ObsidianClient | null): Promise<ProjectSyncResult> {
  const projects: ProjectSyncResult["projects"] = [];

  const entries = client
    ? (await client.listDir(toObsidianPath(client, projRoot))).map((entry) => ({
      name: entry.name,
      isDir: entry.isDir,
    }))
    : await readdir(projRoot, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (isProjectDirEntry(entry)) {
      const projectPath = join(projRoot, entry.name);
      const mainFile = await readProjectMainFile(projectPath, entry.name, client);
      projects.push(projectRecordFromFrontmatter(projRoot, entry.name, projectPath, mainFile));
      continue;
    }

    if (isProjectMarkdownFile(entry)) {
      const filePath = join(projRoot, entry.name);
      try {
        const content = client ? await readMarkdown(client, filePath) : await readFile(filePath, "utf8");
        projects.push(projectRecordFromFrontmatter(projRoot, entry.name.replace(/\.md$/i, ""), filePath, {
          path: filePath,
          content,
        }));
      } catch {
        projects.push(projectRecordFromFrontmatter(projRoot, entry.name.replace(/\.md$/i, ""), filePath, null));
      }
    }
  }

  return { projects };
}

async function createProject(
  projRoot: string,
  projectTitle: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");

  const folderName = formatProjectTitleForWeek(projectTitle);
  const projectDir = join(projRoot, folderName);
  const template = buildProjectTemplate(projectTitle.trim(), new Date());

  for (const [fileName, content] of Object.entries(template)) {
    await writeMarkdown(client, join(projectDir, fileName), content);
  }

  return {
    projectCreated: true,
    projectTitle: folderName,
    projectPath: relative(join(projRoot, ".."), projectDir).replace(/\\/g, "/"),
    createdFiles: Object.keys(template).map((name) => `Project/${folderName}/${name}`),
  };
}

async function addProjectNote(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) {
    throw new Error("Obsidian client required for project writes");
  }

  const projectDir = join(projRoot, project);
  const notesPath = join(projectDir, "notes.md");

  const today = new Date().toISOString().slice(0, 10);
  const entry = `\n### ${today}\n\n${AI_INDICATOR} ${content}\n`;

  try {
    await appendMarkdown(client, notesPath, entry);
  } catch (error) {
    try {
      await readMarkdown(client, notesPath);
      throw error;
    } catch (readError) {
      if (readError !== error) {
        const header = `# ${project} Notes\n`;
        await writeMarkdown(client, notesPath, header + entry);
        return { noteAdded: true };
      }
      throw error;
    }
  }

  return { noteAdded: true };
}

async function setProjectStatus(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { status: ProjectStatus; reason: string };
  const projectPath = join(projRoot, project, "project.md");
  const timelinePath = join(projRoot, project, "timeline.md");
  const now = new Date().toISOString().slice(0, 10);
  const { data, content: body } = matter(await readMarkdown(client, projectPath));
  data.status = input.status;
  data.updated = now;
  assertValidProjectStatus(data.status);
  assertRequiredNextAction(data.status, data.next_action);
  await writeMarkdown(client, projectPath, serializeMarkdownPage(normalizeProjectFrontmatterData(data), body));
  await appendMarkdown(client, timelinePath, formatTimelineEntry({
    date: now,
    type: "status_change",
    summary: `Status changed to ${input.status}: ${input.reason}`,
    links: [input.reason],
  }));
  return { projectUpdated: true };
}

async function setProjectNextAction(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { next_action: string; reason?: string };
  const projectPath = join(projRoot, project, "project.md");
  const { data, content: body } = matter(await readMarkdown(client, projectPath));
  if (!normalizeScalar(input.next_action)) throw new Error("next_action is required");
  data.next_action = input.next_action;
  data.updated = new Date().toISOString().slice(0, 10);
  await writeMarkdown(client, projectPath, serializeMarkdownPage(normalizeProjectFrontmatterData(data), body));
  await appendMarkdown(client, join(projRoot, project, "timeline.md"), formatTimelineEntry({
    date: data.updated,
    type: "decision",
    summary: `Next action updated to ${input.next_action}`,
    links: [input.reason ?? input.next_action],
  }));
  return { projectUpdated: true };
}

async function setProjectDeadline(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { deadline: string };
  return updateProjectDocument(projRoot, project, client, (data) => {
    data.deadline = input.deadline;
  });
}

async function linkProjectResource(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { resource: string };
  return updateProjectDocument(projRoot, project, client, (data) => {
    data.resources = appendUniqueListItem(data.resources, input.resource);
  });
}

async function relateProject(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { project_link: string };
  return updateProjectDocument(projRoot, project, client, (data) => {
    data.related_projects = appendUniqueListItem(data.related_projects, input.project_link);
  });
}

async function appendProjectTimeline(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { type: "status_change" | "decision" | "milestone" | "risk" | "handoff" | "review"; summary: string; links?: string[] };
  await appendMarkdown(client, join(projRoot, project, "timeline.md"), formatTimelineEntry({
    date: new Date().toISOString().slice(0, 10),
    type: input.type,
    summary: input.summary,
    links: input.links ?? [],
  }));
  return { projectUpdated: true };
}

async function addProjectTask(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { summary: string; priority?: "low" | "medium" | "high"; links?: string[] };
  const tasksPath = join(projRoot, project, "tasks.md");
  const current = await readMarkdown(client, tasksPath);
  const next = appendTaskBlock(current, {
    id: nextTaskId(current),
    status: "open",
    priority: input.priority ?? "medium",
    created: new Date().toISOString().slice(0, 10),
    depends_on: [],
    links: input.links ?? [],
    summary: input.summary,
  });
  await writeMarkdown(client, tasksPath, next);
  return { taskUpdated: true };
}

async function updateProjectTask(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { id: string; summary?: string; priority?: "low" | "medium" | "high" };
  const tasksPath = join(projRoot, project, "tasks.md");
  const current = await readMarkdown(client, tasksPath);
  const next = updateTaskBlock(current, input.id, (task) => ({
    ...task,
    summary: input.summary ?? task.summary,
    priority: input.priority ?? task.priority,
  }));
  await writeMarkdown(client, tasksPath, next);
  return { taskUpdated: true };
}

async function blockProjectTask(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { id: string; reason: string };
  const tasksPath = join(projRoot, project, "tasks.md");
  const current = await readMarkdown(client, tasksPath);
  const next = updateTaskBlock(current, input.id, (task) => ({
    ...task,
    status: "blocked",
    links: task.links.includes(input.reason) ? task.links : [...task.links, input.reason],
  }));
  await writeMarkdown(client, tasksPath, next);
  return { taskUpdated: true };
}

async function closeProjectTask(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { id: string };
  const tasksPath = join(projRoot, project, "tasks.md");
  const current = await readMarkdown(client, tasksPath);
  const next = updateTaskBlock(current, input.id, (task) => ({ ...task, status: "done" }));
  await writeMarkdown(client, tasksPath, next);
  return { taskUpdated: true };
}

async function promoteProjectTask(
  root: string,
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  if (!client) throw new Error("Obsidian client required for project writes");
  const input = JSON.parse(content) as { id: string; crossProject?: boolean; urgentToday?: boolean; coordination?: boolean };
  const tasksPath = join(projRoot, project, "tasks.md");
  const current = await readMarkdown(client, tasksPath);
  const task = parseTaskBlocks(current).find((item) => item.id === input.id);
  if (!task) throw new Error(`task not found: ${input.id}`);
  if (!canPromoteTask({ status: task.status, crossProject: input.crossProject, urgentToday: input.urgentToday, coordination: input.coordination })) {
    throw new Error("task does not meet promotion criteria");
  }
  await suggestTask(root, task.summary, client);
  return { taskSuggested: true };
}

export function summarizeProjectReview(projects: Array<{
  path: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  nextAction: string | null;
  lastAction: string | null;
  updated?: string | null;
}>, today: string) {
  const staleThreshold = new Date(today);
  staleThreshold.setDate(staleThreshold.getDate() - 7);
  const staleCutoff = staleThreshold.toISOString().slice(0, 10);

  return {
    blocked: projects.filter((project) => project.status === "blocked"),
    noNextAction: projects.filter((project) =>
      (project.status === "active" || project.status === "waiting" || project.status === "blocked") && !project.nextAction),
    staleActive: projects.filter((project) => project.status === "active" && project.updated && project.updated < staleCutoff),
    archiveCandidates: projects.filter((project) => project.status === "done"),
  };
}

export function canPromoteTask(input: { status: string; crossProject?: boolean; urgentToday?: boolean; coordination?: boolean }) {
  return input.status !== "done" && Boolean(input.crossProject || input.urgentToday || input.coordination);
}

export function formatProjectTitleForWeek(projectTitle: string, date = new Date()): string {
  const week = isoWeekNumber(date);
  return `w${String(week).padStart(2, "0")}-${projectTitle.trim()}`;
}

function isoWeekNumber(date: Date): number {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

async function suggestTask(root: string, content: string, client?: ObsidianClient | null): Promise<ProjectSyncResult> {
  if (!client) {
    throw new Error("Obsidian client required for project writes");
  }

  const listPath = listMdPath(root);
  const today = new Date().toISOString().slice(0, 10);
  const entry = `${AI_INDICATOR} Suggested task: ${content}`;

  const current = await readMarkdown(client, listPath);
  const todaySection = `**${today}**`;

  if (current.includes(todaySection)) {
    const lines = current.split("\n");
    const todayIndex = lines.findIndex((line) => line.includes(todaySection));
    if (todayIndex >= 0) {
      let insertIndex = lines.length;
      for (let i = todayIndex + 1; i < lines.length; i++) {
        if (lines[i].match(/^\*\*\d{4}-\d{2}-\d{2}\*\*/)) {
          insertIndex = i;
          break;
        }
      }
      lines.splice(insertIndex, 0, `\n- [ ] ${entry}\n`);
      await writeMarkdown(client, listPath, lines.join("\n"));
    }
  } else {
    const newSection = `\n---\n\n**${today}**\n\n- [ ] ${entry}\n`;
    await appendMarkdown(client, listPath, newSection);
  }

  return { taskSuggested: true };
}

async function reviewProjects(projRoot: string, client?: ObsidianClient | null): Promise<ProjectSyncResult> {
  const { projects = [] } = await scanProjects(projRoot, client);
  const counts = {
    idea: 0,
    active: 0,
    waiting: 0,
    blocked: 0,
    done: 0,
    archived: 0,
    unknown: 0,
  };
  const blocked: NonNullable<ProjectSyncResult["review"]>["blocked"] = [];
  const noNextAction: NonNullable<ProjectSyncResult["review"]>["noNextAction"] = [];
  const archiveCandidates: NonNullable<ProjectSyncResult["review"]>["archiveCandidates"] = [];

  for (const project of projects) {
    const status = normalizeProjectStatus(project.status);
    counts[status]++;

    if (status === "blocked") {
      blocked.push({
        path: project.path,
        title: project.title,
        status: project.status,
      });
    }

    if ((status === "active" || status === "waiting" || status === "blocked") && !project.nextAction) {
      noNextAction.push({
        path: project.path,
        title: project.title,
        status: project.status,
      });
    }

    if (status === "done") {
      archiveCandidates.push({
        path: project.path,
        title: project.title,
        status: project.status,
      });
    }
  }

  return {
    projects,
    review: {
      counts,
      blocked,
      noNextAction,
      archiveCandidates,
    },
  };
}

function isProjectDirEntry(entry: { name: string; isDir?: boolean; isDirectory?: () => boolean }): boolean {
  return typeof entry.isDirectory === "function" ? entry.isDirectory() : entry.isDir === true;
}

function isProjectMarkdownFile(entry: { name: string; isDir?: boolean; isFile?: () => boolean }): boolean {
  const isFile = typeof entry.isFile === "function" ? entry.isFile() : entry.isDir === false;
  return isFile && entry.name.endsWith(".md") && entry.name !== PROJECTS_CONTROL_FILE;
}

async function readProjectMainFile(
  projectPath: string,
  projectName: string,
  client?: ObsidianClient | null,
): Promise<{ path: string; content: string } | null> {
  const candidates = ["project.md", `${projectName}.md`, ...PROJECT_MAIN_CANDIDATES];
  for (const candidate of candidates) {
    const candidatePath = join(projectPath, candidate);
    try {
      const content = client ? await readMarkdown(client, candidatePath) : await readFile(candidatePath, "utf8");
      return { path: candidatePath, content };
    } catch {
      // Try the next conventional project main file.
    }
  }
  return null;
}

function projectRecordFromFrontmatter(
  projRoot: string,
  fallbackTitle: string,
  projectPath: string,
  mainFile: { path: string; content: string } | null,
): NonNullable<ProjectSyncResult["projects"]>[number] {
  const frontmatter = mainFile ? parseFrontmatter(mainFile.content) : {};
  const title = normalizeOptionalString(frontmatter.project ?? frontmatter.title) ?? fallbackTitle;
  const nextAction = normalizeOptionalString(frontmatter.next_action ?? frontmatter.last_action);
  return {
    path: relative(projRoot, projectPath).replace(/\\/g, "/"),
    mainPath: mainFile ? relative(projRoot, mainFile.path).replace(/\\/g, "/") : undefined,
    title,
    status: normalizeOptionalString(frontmatter.status) ?? "unknown",
    priority: normalizeOptionalString(frontmatter.priority) ?? "medium",
    deadline: normalizeOptionalString(frontmatter.deadline),
    nextAction,
    lastAction: normalizeOptionalString(frontmatter.last_action) ?? nextAction,
    updated: normalizeOptionalString(frontmatter.updated),
  };
}

function normalizeOptionalString(value: any): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeProjectStatus(status: string): "idea" | "active" | "waiting" | "blocked" | "done" | "archived" | "unknown" {
  if (status === "idea") return "idea";
  if (status === "active") return "active";
  if (status === "waiting") return "waiting";
  if (status === "blocked") return "blocked";
  if (status === "done" || status === "complete") return "done";
  if (status === "archived") return "archived";
  return "unknown";
}

async function updateProjectDocument(
  projRoot: string,
  project: string,
  client: ObsidianClient,
  mutator: (data: Record<string, any>) => void,
): Promise<ProjectSyncResult> {
  const projectPath = join(projRoot, project, "project.md");
  const parsed = matter(await readMarkdown(client, projectPath));
  mutator(parsed.data);
  parsed.data.updated = new Date().toISOString().slice(0, 10);
  await writeMarkdown(client, projectPath, serializeMarkdownPage(normalizeProjectFrontmatterData(parsed.data), parsed.content));
  return { projectUpdated: true };
}

function appendUniqueListItem(value: unknown, item: string): string[] {
  const list = Array.isArray(value) ? value.map(String) : [];
  return list.includes(item) ? list : [...list, item];
}

function assertValidProjectStatus(status: unknown): asserts status is ProjectStatus {
  const normalized = normalizeScalar(status);
  if (!["idea", "active", "waiting", "blocked", "done", "archived"].includes(normalized)) {
    throw new Error("status is invalid");
  }
}

function assertRequiredNextAction(status: unknown, nextAction: unknown): void {
  const normalizedStatus = normalizeScalar(status);
  const normalizedNextAction = normalizeScalar(nextAction);
  if ((normalizedStatus === "active" || normalizedStatus === "waiting" || normalizedStatus === "blocked") && !normalizedNextAction) {
    throw new Error(`next_action is required when status is ${normalizedStatus}`);
  }
}

function normalizeScalar(value: unknown): string {
  if (Array.isArray(value)) return normalizeScalar(value[0]);
  if (value == null) return "";
  return String(value).trim();
}

function normalizeProjectFrontmatterData(data: Record<string, any>): Record<string, any> {
  return {
    ...data,
    type: normalizeScalar(data.type) || "project",
    title: normalizeScalar(data.title),
    status: normalizeScalar(data.status),
    created: normalizeDateScalar(data.created),
    updated: normalizeDateScalar(data.updated),
    area: normalizeLinkScalar(data.area),
    priority: normalizeScalar(data.priority),
    deadline: normalizeDateScalar(data.deadline),
    next_action: normalizeLinkScalar(data.next_action),
    review_after: normalizeDateScalar(data.review_after),
    resources: normalizeLinkList(data.resources),
    related_projects: normalizeLinkList(data.related_projects),
    tags: normalizeStringList(data.tags),
  };
}

function normalizeLinkScalar(value: unknown): string {
  const normalized = normalizeScalar(value);
  if (!normalized) return "";
  if (normalized.startsWith("[[") || normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  return `[[${normalized}]]`;
}

function normalizeLinkList(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map((item) => normalizeLinkScalar(item)).filter(Boolean) : [];
  return Array.from(new Set(list));
}

function normalizeStringList(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map((item) => normalizeScalar(item)).filter(Boolean) : [];
  return Array.from(new Set(list));
}

function normalizeDateScalar(value: unknown): string {
  if (value == null || value === "") return "";
  const scalar = normalizeScalar(value);
  if (!scalar) return "";
  const date = new Date(scalar);
  if (Number.isNaN(date.getTime())) return scalar;
  return date.toISOString().slice(0, 10);
}

function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result: Record<string, any> = {};
  for (const line of yaml.split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)/);
    if (kv) {
      result[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}
