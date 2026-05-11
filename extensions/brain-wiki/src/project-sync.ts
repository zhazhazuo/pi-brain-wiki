import { mkdir, readFile, readdir, appendFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { appendMarkdown, readMarkdown, serializeMarkdownPage, toObsidianPath, writeMarkdownPage, writeMarkdown } from "./obsidian-io.ts";
import { projectRoot, listMdPath } from "./paths.ts";
import type { ProjectSyncAction, ProjectSyncResult } from "./types.ts";
import type { ObsidianClient } from "./obsidian-client.ts";

const AI_INDICATOR = "> 🤖 [AI]";

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
    default:
      throw new Error(`Unknown project sync action: ${action}`);
  }
}

async function scanProjects(projRoot: string, client?: ObsidianClient | null): Promise<ProjectSyncResult> {
  const projects: ProjectSyncResult["projects"] = [];

  const entries = client
    ? (await client.listDir(toObsidianPath(client, projRoot))).map((entry) => ({ ...entry, isDirectory: () => entry.isDir }))
    : await readdir(projRoot, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectPath = join(projRoot, entry.name);
    const indexPath = join(projectPath, "index.md");

    try {
      const content = client ? await readMarkdown(client, indexPath) : await readFile(indexPath, "utf8");
      const frontmatter = parseFrontmatter(content);

      projects.push({
        path: relative(projRoot, projectPath),
        title: frontmatter.title ?? entry.name,
        status: frontmatter.status ?? "unknown",
        priority: frontmatter.priority ?? "medium",
        deadline: frontmatter.deadline ?? null,
        lastAction: frontmatter.last_action ?? null,
      });
    } catch {
      // No index.md or unreadable
      projects.push({
        path: relative(projRoot, projectPath),
        title: entry.name,
        status: "unknown",
        priority: "medium",
        deadline: null,
        lastAction: null,
      });
    }
  }

  return { projects };
}

async function createProject(
  projRoot: string,
  projectTitle: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  const title = formatProjectTitleForWeek(projectTitle);
  const absolutePath = join(projRoot, title, `${title}.md`);
  const frontmatter = {
    title,
    status: "active",
    priority: "medium",
    created: new Date().toISOString().slice(0, 10),
  };
  const body = `# ${title}\n\n## Goal\n\n## Notes\n\n## Tasks\n`;

  if (client) {
    await writeMarkdownPage(client, absolutePath, frontmatter, body);
  } else {
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, serializeMarkdownPage(frontmatter, body), "utf8");
  }

  return {
    projectCreated: true,
    projectTitle: title,
    projectPath: relative(join(projRoot, ".."), absolutePath).replace(/\\/g, "/"),
  };
}

async function addProjectNote(
  projRoot: string,
  project: string,
  content: string,
  client?: ObsidianClient | null,
): Promise<ProjectSyncResult> {
  const projectDir = join(projRoot, project);
  const notesPath = join(projectDir, "notes.md");

  const today = new Date().toISOString().slice(0, 10);
  const entry = `\n### ${today}\n\n${AI_INDICATOR} ${content}\n`;

  if (client) {
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
  } else {
    try {
      await appendFile(notesPath, entry, "utf8");
    } catch {
      const header = `# ${project} Notes\n`;
      await writeFile(notesPath, header + entry, "utf8");
    }
  }

  return { noteAdded: true };
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
  const listPath = listMdPath(root);
  const today = new Date().toISOString().slice(0, 10);
  const entry = `${AI_INDICATOR} Suggested task: ${content}`;

  const current = client ? await readMarkdown(client, listPath) : await readFile(listPath, "utf8");
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
      if (client) {
        await writeMarkdown(client, listPath, lines.join("\n"));
      } else {
        await writeFile(listPath, lines.join("\n"), "utf8");
      }
    }
  } else {
    const newSection = `\n---\n\n**${today}**\n\n- [ ] ${entry}\n`;
    if (client) {
      await appendMarkdown(client, listPath, newSection);
    } else {
      await appendFile(listPath, newSection, "utf8");
    }
  }

  return { taskSuggested: true };
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
