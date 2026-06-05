import { readFile } from "node:fs/promises";
import { listMdPath } from "./paths.ts";
import type { RegistryData, ScanProposal } from "./types.ts";

export function scanListMdItems(content: string, sinceIso: string): ScanProposal[] {
  const since = new Date(sinceIso);
  const proposals: ScanProposal[] = [];
  let currentDate = "";
  let itemIndex = 0;

  for (const line of content.split("\n")) {
    const dateMatch = line.match(/^\*{2}(\d{4}-\d{2}-\d{2})\*{2}/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    const taskMatch = line.match(/^-\s*\[([ x>])\]\s*(.+)/);
    if (taskMatch && currentDate) {
      itemIndex++;
      const done = taskMatch[1] === "x";
      const text = taskMatch[2].trim();
      if (done) continue;

      const itemDate = new Date(currentDate);
      const daysSince = Math.floor((since.getTime() - itemDate.getTime()) / 86_400_000);
      if (daysSince > 7) {
        const shortText = text.length > 40 ? text.slice(0, 40) + "..." : text;
        proposals.push({
          description: `RD: Process LIST.md item — ${shortText}`,
          project: "Wiki.List-Backlog",
          scheduled: sinceIso,
          priority: "M",
          estimate: 0.5,
          tags: ["RD"],
          reason: `Unprocessed LIST.md item from ${currentDate} (${daysSince} days old)`,
          source: `LIST.md:item-${itemIndex}`,
        });
      }
    }
  }

  return proposals;
}

export async function scanVaultForTasks(
  root: string,
  registry: RegistryData,
  options?: { scope?: "list_md" | "projects" | "wiki_meta" | "all"; since?: string },
): Promise<ScanProposal[]> {
  const scope = options?.scope ?? "all";
  const since = options?.since ?? new Date().toISOString().slice(0, 10);
  const proposals: ScanProposal[] = [];

  if (scope === "list_md" || scope === "all") {
    try {
      const listContent = await readFile(listMdPath(root), "utf8");
      proposals.push(...scanListMdItems(listContent, since));
    } catch {
      // LIST.md may not exist
    }
  }

  if (scope === "projects" || scope === "all") {
    // First pass: project scanning is reserved for follow-up
  }

  if (scope === "wiki_meta" || scope === "all") {
    // First pass: wiki meta scanning is reserved for follow-up
  }

  return proposals;
}
