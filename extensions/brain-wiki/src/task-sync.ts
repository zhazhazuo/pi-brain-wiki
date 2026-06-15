import { listMdPath } from "./paths.ts";
import { taskExport } from "./task-cli.ts";
import { readMarkdown, writeMarkdown } from "./obsidian-io.ts";
import type { CommandRunner } from "./capture.ts";
import type { ObsidianClient } from "./obsidian-client.ts";
import type { TaskExportRecord } from "./types.ts";

/**
 * Locate a specific LIST.md line by date and ordinal index.
 * Indexing matches scanListMdItems: resets per date, counts every checkbox line.
 */
export function findListItem(
  content: string,
  date: string,
  itemIndex: number,
): { lineIndex: number; line: string } | null {
  let currentDate = "";
  let currentIndex = 0;
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const dateMatch = lines[i].match(/^\*{2}(\d{4}-\d{2}-\d{2})\*{2}/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      currentIndex = 0;
      continue;
    }

    const taskMatch = lines[i].match(/^-\s*\[([ x>])\]\s*(.+)/);
    if (taskMatch && currentDate === date) {
      currentIndex++;
      if (currentIndex === itemIndex) {
        return { lineIndex: i, line: lines[i] };
      }
    }
  }
  return null;
}

/** Change `- [ ]` to `- [>]` to show the item was promoted to Taskwarrior. */
export async function markListItemPromoted(
  root: string,
  date: string,
  itemIndex: number,
  client?: ObsidianClient | null,
): Promise<boolean> {
  if (!client) {
    throw new Error("Obsidian client required for LIST.md writes");
  }

  const listPath = listMdPath(root);
  const content = await readMarkdown(client, listPath);
  const lines = content.split("\n");

  const item = findListItem(content, date, itemIndex);
  if (!item) return false;

  lines[item.lineIndex] = item.line.replace(/^-\s*\[ \]/, "- [>]");

  const newContent = lines.join("\n");
  await writeMarkdown(client, listPath, newContent);
  return true;
}

/** Change `- [ ]` or `- [>]` to `- [x]` when the linked task is completed. */
export async function markListItemDone(
  root: string,
  date: string,
  itemIndex: number,
  client?: ObsidianClient | null,
): Promise<boolean> {
  if (!client) {
    throw new Error("Obsidian client required for LIST.md writes");
  }

  const listPath = listMdPath(root);
  const content = await readMarkdown(client, listPath);
  const lines = content.split("\n");

  const item = findListItem(content, date, itemIndex);
  if (!item) return false;

  lines[item.lineIndex] = item.line.replace(/^-\s*\[([ >])\]/, "- [x]");

  const newContent = lines.join("\n");
  await writeMarkdown(client, listPath, newContent);
  return true;
}

export interface TaskWithSource {
  id: number;
  description: string;
  status: string;
  source?: string;
  annotations?: string[];
}

/** Export all tasks and extract those carrying a `source:` annotation. */
export async function getTasksWithListSource(
  runner: CommandRunner,
): Promise<TaskWithSource[]> {
  const allTasks = await taskExport(runner, "status:pending or status:completed");
  return allTasks.map((t) => {
    const sourceAnnotation = t.annotations?.find((a) =>
      a.description.startsWith("source:")
    );
    return {
      id: t.id,
      description: t.description,
      status: t.status,
      source: sourceAnnotation?.description.slice(7).trim(),
      annotations: t.annotations?.map((a) => a.description),
    };
  });
}

/**
 * Find completed Taskwarrior tasks that originated from LIST.md and mark the
 * corresponding LIST.md items as done.
 */
export async function syncCompletedTasksToList(
  root: string,
  runner: CommandRunner,
  client?: ObsidianClient | null,
): Promise<{ markedDone: number; errors: string[] }> {
  const tasks = await getTasksWithListSource(runner);
  const completed = tasks.filter((t) => t.status === "completed");
  const result: { markedDone: number; errors: string[] } = {
    markedDone: 0,
    errors: [],
  };

  for (const task of completed) {
    if (!task.source) continue;
    const match = task.source.match(
      /^LIST\.md:(\d{4}-\d{2}-\d{2}):item-(\d+)$/,
    );
    if (!match) continue;

    const [, date, itemIndexStr] = match;
    const itemIndex = parseInt(itemIndexStr, 10);

    try {
      const success = await markListItemDone(root, date, itemIndex, client);
      if (success) result.markedDone++;
    } catch (error) {
      result.errors.push(
        `Failed to mark ${task.source} as done: ${(error as Error).message}`,
      );
    }
  }

  return result;
}
