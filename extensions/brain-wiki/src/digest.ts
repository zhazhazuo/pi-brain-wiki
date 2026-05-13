import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readEvents } from "./log.ts";
import { metaPath } from "./paths.ts";
import type { RegistryData, RegistryEntry, WikiEvent } from "./types.ts";

const BELOW_MINIMUM_WORDS = 100;
const RECENT_DAYS = 7;

export async function buildDigest(
  root: string,
  registry: RegistryData,
): Promise<string> {
  const events = await readEvents(root);
  const now = new Date();
  const recentSince = new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000);

  const stats = buildStats(registry);
  const activeDiscussions = await readActiveDiscussions(root);
  const recentEvents = filterRecentEvents(events, recentSince);
  const needsAttention = findNeedsAttention(registry, now);
  const stale = findStale(registry, events, now);

  const lines: string[] = [
    "# Wiki Digest",
    "",
    `Generated: ${now.toISOString()}`,
    "",
    "## Stats",
    `- Topics: ${stats.topic} | Summaries: ${stats.summary} | Plans: ${stats.plan} | Reviews: ${stats.review} | Workflows: ${stats.workflow}`,
    `- Sources: ${stats.captured} captured, ${stats.integrated} integrated, ${stats.consumed} consumed`,
    `- Workflow routes: [[meta/workflows]]`,
    "",
  ];

  lines.push("## Active Discussions");
  if (activeDiscussions.length === 0) {
    lines.push("(none)");
  } else {
    for (const d of activeDiscussions) {
      lines.push(`- [${d.date}] ${d.topic} — ${d.state}`);
    }
  }
  lines.push("");

  lines.push("## Recent Events (last 7d)");
  if (recentEvents.length === 0) {
    lines.push("(none)");
  } else {
    for (const e of recentEvents) {
      lines.push(`- ${e.ts.slice(0, 10)} ${e.kind}: ${e.title}`);
    }
  }
  lines.push("");

  lines.push("## Needs Attention");
  if (needsAttention.length === 0) {
    lines.push("(none)");
  } else {
    for (const item of needsAttention) {
      lines.push(`- ${item.path}: ${item.message}`);
    }
  }
  lines.push("");

  lines.push("## Stale");
  if (stale.length === 0) {
    lines.push("(none)");
  } else {
    for (const item of stale) {
      lines.push(`- ${item.path}: ${item.message}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

export async function rebuildDigest(
  root: string,
  registry: RegistryData,
): Promise<string> {
  const content = await buildDigest(root, registry);
  const digestPath = metaPath(root, "wiki-digest.md");
  await writeFile(digestPath, content, "utf8");
  return toRelative(root, digestPath);
}

// ── Internal helpers ─────────────────────────────────────────

interface StatCounts {
  topic: number;
  summary: number;
  plan: number;
  review: number;
  workflow: number;
  captured: number;
  integrated: number;
  consumed: number;
}

function buildStats(registry: RegistryData): StatCounts {
  const counts: StatCounts = {
    topic: 0,
    summary: 0,
    plan: 0,
    review: 0,
    workflow: 0,
    captured: 0,
    integrated: 0,
    consumed: 0,
  };

  for (const page of registry.pages) {
    if (page.type === "topic") counts.topic++;
    if (page.type === "summary") counts.summary++;
    if (page.type === "plan") counts.plan++;
    if (page.type === "review") counts.review++;
    if (page.type === "workflow") counts.workflow++;

    if (page.type === "summary") {
      if (page.status === "captured") counts.captured++;
      if (page.status === "integrated") counts.integrated++;
      if (page.status === "consumed") counts.consumed++;
    }
  }

  return counts;
}

interface DiscussionEntry {
  date: string;
  topic: string;
  state: string;
}

async function readActiveDiscussions(root: string): Promise<DiscussionEntry[]> {
  const routePath = join(root, "discussions", "route.md");
  try {
    const raw = await readFile(routePath, "utf8");
    const active: DiscussionEntry[] = [];
    let inActive = false;

    for (const line of raw.split("\n")) {
      if (line.startsWith("## Active")) {
        inActive = true;
        continue;
      }
      if (line.startsWith("## ")) {
        inActive = false;
        continue;
      }
      if (inActive && line.startsWith("- [")) {
        const match = line.match(/^-\s*\[([^\]]+)\]\s+(.+?)\s+—\s+(.+)$/);
        if (match) {
          active.push({ date: match[1].trim(), topic: match[2].trim(), state: match[3].trim() });
        }
      }
    }

    return active;
  } catch {
    return [];
  }
}

function filterRecentEvents(events: WikiEvent[], since: Date): WikiEvent[] {
  return events
    .filter((e) => new Date(e.ts) >= since)
    .sort((a, b) => b.ts.localeCompare(a.ts));
}

interface AttentionItem {
  path: string;
  message: string;
}

function findNeedsAttention(registry: RegistryData, now: Date): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const page of registry.pages) {
    if (page.type === "topic" && (page.wordCount ?? 0) < BELOW_MINIMUM_WORDS) {
      items.push({
        path: page.path,
        message: `${page.wordCount ?? 0} words (below minimum)`,
      });
    }

    if (page.type === "topic" && page.status === "draft" && page.updated) {
      const days = daysSince(new Date(page.updated), now);
      if (days > 14) {
        items.push({
          path: page.path,
          message: `no activity in ${days}d`,
        });
      }
    }
  }

  return items;
}

interface StaleItem {
  path: string;
  message: string;
}

function findStale(registry: RegistryData, _events: WikiEvent[], now: Date): StaleItem[] {
  const items: StaleItem[] = [];

  for (const page of registry.pages) {
    if (page.type === "summary" && page.status === "integrated" && page.updated) {
      const days = daysSince(new Date(page.updated), now);
      if (days > 14) {
        items.push({
          path: page.path,
          message: `integrated ${days}d, not consumed`,
        });
      }
    }
  }

  return items;
}

function daysSince(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function toRelative(root: string, absolutePath: string): string {
  const rel = absolutePath.replace(root + "/", "").replace(/\\/g, "/");
  return rel;
}
