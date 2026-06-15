import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { parsePage, setPageProperty, writePage } from "./frontmatter.ts";
import { readMarkdown, setMarkdownProperty, writeMarkdown } from "./obsidian-io.ts";
import { metaPath, sourcePacketDir } from "./paths.ts";
import { todayStamp } from "./slug.ts";
import type { WikiEvent } from "./types.ts";
import type { ObsidianClient } from "./obsidian-client.ts";

export async function appendEvent(
  root: string,
  event: WikiEvent,
  client?: ObsidianClient | null
): Promise<void> {
  const eventsPath = metaPath(root, "events.jsonl");
  const eventLine = JSON.stringify(event);

  // Fallback: read-modify-write
  await mkdir(join(root, "meta"), { recursive: true });
  const existing = await readEvents(root);
  existing.push(event);
  await writeFile(eventsPath, `${existing.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
}

export async function readEvents(root: string): Promise<WikiEvent[]> {
  try {
    const raw = await readFile(metaPath(root, "events.jsonl"), "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as WikiEvent);
  } catch {
    return [];
  }
}

export function renderLogMarkdown(title: string, events: WikiEvent[]): string {
  const lines: string[] = [`# ${title} Log`, ""];
  if (events.length === 0) {
    lines.push("_No events yet._");
    return `${lines.join("\n")}\n`;
  }

  for (const event of events) {
    lines.push(`## [${formatTimestamp(event.ts)}] ${event.kind} | ${event.title}`);
    if (event.summary) lines.push(`- Summary: ${event.summary}`);
    if (event.sourceIds?.length) {
      lines.push(`- Sources: ${event.sourceIds.map((id) => `[[inbox/${id}|${id}]]`).join(", ")}`);
    }
    if (event.pagePaths?.length) {
      lines.push(
        `- Pages: ${event.pagePaths
          .map((path) => `[[${path.replace(/\.md$/, "")}]]`)
          .join(", ")}`,
      );
    }
    if (event.notes?.length) lines.push(`- Notes: ${event.notes.join("; ")}`);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function rebuildLog(root: string, title: string): Promise<string> {
  const events = await readEvents(root);
  await writeFile(metaPath(root, "log.md"), renderLogMarkdown(title, events), "utf8");
  return "meta/log.md";
}

export async function markPageStatus(
  root: string,
  pagePaths: string[],
  status: string,
  extraFields: Record<string, any>,
  client?: ObsidianClient | null,
): Promise<void> {
  for (const relativePath of pagePaths) {
    const absolutePath = join(root, relativePath);

    if (client) {
      await setMarkdownProperty(client, absolutePath, "status", status);
      await setMarkdownProperty(client, absolutePath, "updated", todayStamp(new Date()));
      for (const [key, value] of Object.entries(extraFields)) {
        if (value !== undefined) {
          await setPageProperty(absolutePath, key, value, client);
        }
      }
      continue;
    }

    // Fallback: use gray-matter
    try {
      const page = await parsePage(root, absolutePath);
      await writePage(
        absolutePath,
        {
          ...page.frontmatter,
          status,
          updated: todayStamp(new Date()),
          ...extraFields,
        },
        page.body,
      );
    } catch {
      // Skip pages that don't exist or can't be parsed
    }
  }
}

export async function markSourcesIntegrated(
  root: string,
  sourceIds: string[],
  integratedAt: string,
  client?: ObsidianClient | null,
): Promise<void> {
  for (const sourceId of sourceIds) {
    const manifestPath = join(sourcePacketDir(root, sourceId), "manifest.json");
    if (client) {
      try {
        const manifestRaw = await readMarkdown(client, manifestPath);
        const manifest = JSON.parse(manifestRaw) as Record<string, any>;
        manifest.status = "integrated";
        manifest.integratedAt = integratedAt;
        const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
        await writeMarkdown(client, manifestPath, manifestContent);
      } catch {
        // Some sessions integrate a source after the packet was captured elsewhere
        // or when the manifest is unavailable through the CLI boundary. The
        // integration can continue because the summary page and event log are the
        // canonical records.
      }
    } else {
      try {
        const manifestRaw = await readFile(manifestPath, "utf8");
        const manifest = JSON.parse(manifestRaw) as Record<string, any>;
        manifest.status = "integrated";
        manifest.integratedAt = integratedAt;
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      } catch {
        // Ignore missing manifests so logging remains robust without a CLI client.
      }
    }

    // Find and update the summary page — scan pages/summaries/ for matching source_id
    const summariesDir = join(root, "pages", "summaries");
    if (client) {
      const pages = await client.files({ folder: "Wiki/pages/summaries", ext: "md" });
      for (const pagePath of pages) {
        try {
          const raw = await readMarkdown(client, pagePath);
          const parsed = matter(raw);
          const srcIds: string[] = Array.isArray(parsed.data.source_ids) ? parsed.data.source_ids : [];
          if (srcIds.includes(sourceId)) {
            await writePage(
              pagePath,
              {
                ...parsed.data,
                status: "integrated",
                integrated_at: integratedAt,
                updated: todayStamp(new Date(integratedAt)),
              },
              parsed.content,
              client,
            );
          }
        } catch {
          // Skip missing or unreadable summary pages and continue scanning.
        }
      }
    } else {
      try {
        const pages = await readdir(summariesDir);
        for (const pageFile of pages) {
          if (!pageFile.endsWith(".md")) continue;
          const pagePath = join(summariesDir, pageFile);
          try {
            const page = await parsePage(root, pagePath);
            const srcIds: string[] = Array.isArray(page.frontmatter.source_ids) ? page.frontmatter.source_ids : [];
            if (srcIds.includes(sourceId)) {
              await writePage(
                pagePath,
                {
                  ...page.frontmatter,
                  status: "integrated",
                  integrated_at: integratedAt,
                  updated: todayStamp(new Date(integratedAt)),
                },
                page.body,
              );
            }
          } catch {
            // Skip unparseable pages
          }
        }
      } catch {
        // Summaries dir may not exist yet
      }
    }
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
