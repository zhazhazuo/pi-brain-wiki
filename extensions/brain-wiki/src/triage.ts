import { readFile, appendFile, writeFile } from "node:fs/promises";
import { appendMarkdown, readMarkdown, writeMarkdown } from "./obsidian-io.ts";
import { listMdPath } from "./paths.ts";
import type { TriageAction, TriageResult } from "./types.ts";
import type { ObsidianClient } from "./obsidian-client.ts";

const AI_INDICATOR = "> 🤖 [AI]";

export async function triageList(
  root: string,
  action: TriageAction,
  content?: string,
  client?: ObsidianClient | null,
): Promise<TriageResult> {
  const listPath = listMdPath(root);

  switch (action) {
    case "read":
      return readList(listPath, client);
    case "add":
      if (!content) throw new Error("content required for add action");
      return addToList(listPath, content, client);
    case "suggest":
      return suggestFromList(listPath, client);
    case "flag_stale":
      return flagStaleItems(listPath, client);
    default:
      throw new Error(`Unknown triage action: ${action}`);
  }
}

async function readList(listPath: string, client?: ObsidianClient | null): Promise<TriageResult> {
  const content = client ? await readMarkdown(client, listPath) : await readFile(listPath, "utf8");
  const items = parseListItems(content);

  const uncheckedItems = items.filter((item) => !item.done);
  const staleItems = uncheckedItems.filter((item) => item.daysSince > 7);
  const recentItems = items.filter((item) => item.daysSince <= 3);

  return {
    analysis: {
      totalItems: items.length,
      uncheckedItems: uncheckedItems.length,
      staleItems: staleItems.length,
      recentItems: recentItems.length,
    },
  };
}

async function addToList(listPath: string, content: string, client?: ObsidianClient | null): Promise<TriageResult> {
  const today = new Date().toISOString().slice(0, 10);
  const entry = `\n${AI_INDICATOR} ${content}\n`;

  // Read current content to find today's section
  const current = client ? await readMarkdown(client, listPath) : await readFile(listPath, "utf8");
  const todaySection = `**${today}**`;

  if (current.includes(todaySection)) {
    // Append to today's section
    const lines = current.split("\n");
    const todayIndex = lines.findIndex((line) => line.includes(todaySection));
    if (todayIndex >= 0) {
      // Find the next date section or end of file
      let insertIndex = lines.length;
      for (let i = todayIndex + 1; i < lines.length; i++) {
        if (lines[i].match(/^\*\*\d{4}-\d{2}-\d{2}\*\*/)) {
          insertIndex = i;
          break;
        }
      }
      lines.splice(insertIndex, 0, entry);
      if (client) {
        await writeMarkdown(client, listPath, lines.join("\n"));
      } else {
        await writeFile(listPath, lines.join("\n"), "utf8");
      }
    }
  } else {
    // Create new today section
    const newSection = `\n---\n\n**${today}**\n${entry}`;
    if (client) {
      await appendMarkdown(client, listPath, newSection);
    } else {
      await appendFile(listPath, newSection, "utf8");
    }
  }

  return { added: true };
}

async function suggestFromList(listPath: string, client?: ObsidianClient | null): Promise<TriageResult> {
  const content = client ? await readMarkdown(client, listPath) : await readFile(listPath, "utf8");
  const items = parseListItems(content);

  // Find items with URLs that could be captured
  const urlItems = items.filter((item) =>
    !item.done && /https?:\/\//.test(item.text)
  );

  // Find items that mention projects
  const projectItems = items.filter((item) =>
    !item.done && /\[\[Project\//.test(item.text)
  );

  const suggestions: string[] = [];

  if (urlItems.length > 0) {
    suggestions.push(`Found ${urlItems.length} items with URLs that could be captured as sources.`);
  }

  if (projectItems.length > 0) {
    suggestions.push(`Found ${projectItems.length} items linked to projects.`);
  }

  return { suggestions };
}

async function flagStaleItems(listPath: string, client?: ObsidianClient | null): Promise<TriageResult> {
  const content = client ? await readMarkdown(client, listPath) : await readFile(listPath, "utf8");
  const items = parseListItems(content);
  const staleItems = items.filter((item) => !item.done && item.daysSince > 7);

  if (staleItems.length === 0) {
    return { suggestions: ["No stale items found."] };
  }

  const suggestions = staleItems.map((item) =>
    `Stale (${item.daysSince}d): ${item.text.slice(0, 60)}${item.text.length > 60 ? "..." : ""}`
  );

  return { suggestions };
}

interface ListItem {
  date: string;
  text: string;
  done: boolean;
  daysSince: number;
}

function parseListItems(content: string): ListItem[] {
  const items: ListItem[] = [];
  let currentDate = "";
  const now = Date.now();

  for (const line of content.split("\n")) {
    const dateMatch = line.match(/^\*{2}(\d{4}-\d{2}-\d{2})\*{2}/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    const taskMatch = line.match(/^-\s*\[([ x>])\]\s*(.+)/);
    if (taskMatch && currentDate) {
      const text = taskMatch[2].trim();
      const rawDate = new Date(currentDate);
      const daysSince = Math.floor((now - rawDate.getTime()) / 86_400_000);
      items.push({
        date: currentDate,
        text,
        done: taskMatch[1] === "x",
        daysSince,
      });
    }
  }

  return items;
}
