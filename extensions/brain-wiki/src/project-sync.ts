import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { appendMarkdown, readMarkdown, toObsidianPath, writeMarkdown } from "./obsidian-io.ts";
import { buildProjectTemplate } from "./project-schema.ts";
import type { ProjectStatus } from "./project-schema.ts";
import { formatTimelineEntry } from "./project-timeline.ts";
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
  const current = await readMarkdown(client, projectPath);
  const next = current
    .replace(/^status:\s*.*$/m, `status: ${input.status}`)
    .replace(/^updated:\s*.*$/m, `updated: ${new Date().toISOString().slice(0, 10)}`);
  await writeMarkdown(client, projectPath, next);
  await appendMarkdown(client, timelinePath, formatTimelineEntry({
    date: new Date().toISOString().slice(0, 10),
    type: "status_change",
    summary: `Status changed to ${input.status}: ${input.reason}`,
    links: [input.reason],
  }));
  return { projectUpdated: true };
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
    active: 0,
    waiting: 0,
    complete: 0,
    archived: 0,
    unknown: 0,
  };
  const noNextAction: NonNullable<ProjectSyncResult["review"]>["noNextAction"] = [];
  const archiveCandidates: NonNullable<ProjectSyncResult["review"]>["archiveCandidates"] = [];

  for (const project of projects) {
    const status = normalizeProjectStatus(project.status);
    counts[status]++;

    if ((status === "active" || status === "waiting") && !project.nextAction) {
      noNextAction.push({
        path: project.path,
        title: project.title,
        status: project.status,
      });
    }

    if (status === "complete") {
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
  const candidates = [`${projectName}.md`, ...PROJECT_MAIN_CANDIDATES];
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
  };
}

function normalizeOptionalString(value: any): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeProjectStatus(status: string): "active" | "waiting" | "complete" | "archived" | "unknown" {
  if (status === "active") return "active";
  if (status === "waiting") return "waiting";
  if (status === "complete") return "complete";
  if (status === "archived") return "archived";
  return "unknown";
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
