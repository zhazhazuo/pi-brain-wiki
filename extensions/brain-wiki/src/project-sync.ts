import { readFile, readdir, appendFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { projectRoot, listMdPath } from "./paths.ts";
import type { ProjectSyncAction, ProjectSyncResult } from "./types.ts";

const AI_INDICATOR = "> 🤖 [AI]";

export async function syncProject(
  root: string,
  action: ProjectSyncAction,
  project?: string,
  content?: string,
): Promise<ProjectSyncResult> {
  const projRoot = projectRoot(root);

  switch (action) {
    case "scan":
      return scanProjects(projRoot);
    case "add_note":
      if (!project || !content) throw new Error("project and content required for add_note");
      return addProjectNote(projRoot, project, content);
    case "suggest_task":
      if (!content) throw new Error("content required for suggest_task");
      return suggestTask(root, content);
    default:
      throw new Error(`Unknown project sync action: ${action}`);
  }
}

async function scanProjects(projRoot: string): Promise<ProjectSyncResult> {
  const projects: ProjectSyncResult["projects"] = [];

  try {
    const entries = await readdir(projRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectPath = join(projRoot, entry.name);
      const indexPath = join(projectPath, "index.md");

      try {
        const content = await readFile(indexPath, "utf8");
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
  } catch {
    // Project/ dir may not exist
  }

  return { projects };
}

async function addProjectNote(
  projRoot: string,
  project: string,
  content: string,
): Promise<ProjectSyncResult> {
  const projectDir = join(projRoot, project);
  const notesPath = join(projectDir, "notes.md");

  const today = new Date().toISOString().slice(0, 10);
  const entry = `\n### ${today}\n\n${AI_INDICATOR} ${content}\n`;

  try {
    await appendFile(notesPath, entry, "utf8");
  } catch {
    // Create notes.md if it doesn't exist
    const header = `# ${project} Notes\n`;
    await writeFile(notesPath, header + entry, "utf8");
  }

  return { noteAdded: true };
}

async function suggestTask(root: string, content: string): Promise<ProjectSyncResult> {
  const listPath = listMdPath(root);
  const today = new Date().toISOString().slice(0, 10);
  const entry = `${AI_INDICATOR} Suggested task: ${content}`;

  const current = await readFile(listPath, "utf8");
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
      await writeFile(listPath, lines.join("\n"), "utf8");
    }
  } else {
    const newSection = `\n---\n\n**${today}**\n\n- [ ] ${entry}\n`;
    await appendFile(listPath, newSection, "utf8");
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
