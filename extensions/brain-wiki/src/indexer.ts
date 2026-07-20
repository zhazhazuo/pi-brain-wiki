import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "./config.ts";
import { parsePage } from "./frontmatter.ts";
import { metaPath, toRelative } from "./paths.ts";
import type { BacklinksData, BacklinksRecord, Edge, EdgeRecord, EdgesData, ParsedPage, RegistryData, RegistryEntry, WikiPageType } from "./types.ts";
import type { ObsidianClient } from "./obsidian-client.ts";

const PAGE_ORDER: WikiPageType[] = ["summary", "topic", "plan", "review", "workflow"];

export async function scanWikiPages(root: string): Promise<ParsedPage[]> {
  const config = await loadConfig(root);
  const pages: ParsedPage[] = [];
  for (const relativeDir of Object.values(config.pageTypes)) {
    const absoluteDir = join(root, relativeDir);
    const files = await walkMarkdownFiles(absoluteDir);
    for (const file of files) {
      pages.push(await parsePage(root, file));
    }
  }
  pages.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return pages;
}

export function buildRegistry(pages: ParsedPage[]): RegistryData {
  const entries: RegistryEntry[] = pages.map((page) => {
    const type = String(page.frontmatter.type || inferTypeFromPath(page.relativePath)) as WikiPageType;
    const pkbRefs = arrayOfStrings(page.frontmatter.pkb_refs);
    return {
      id: String(page.frontmatter.id ?? page.relativePath),
      type,
      path: page.relativePath,
      title: String(page.frontmatter.title ?? page.relativePath),
      aliases: arrayOfStrings(page.frontmatter.aliases),
      summary: typeof page.frontmatter.summary === "string" ? page.frontmatter.summary : undefined,
      status: typeof page.frontmatter.status === "string" ? page.frontmatter.status : undefined,
      tags: arrayOfStrings(page.frontmatter.tags),
      updated: typeof page.frontmatter.updated === "string" ? page.frontmatter.updated : undefined,
      sourceIds: arrayOfStrings(page.frontmatter.source_ids),
      consumedAt: typeof page.frontmatter.consumed_at === "string" && page.frontmatter.consumed_at ? page.frontmatter.consumed_at : undefined,
      pkbRefs: pkbRefs.length > 0 ? pkbRefs : undefined,
      edges: parseEdges(page.frontmatter.edges),
      linksOut: [...new Set(page.normalizedLinks)],
      headings: page.headings,
      wordCount: page.wordCount,
      externalBacklinks: 0,
      externalSources: [],
    };
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    pages: entries.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export function buildBacklinks(registry: RegistryData): BacklinksData {
  const known = new Set(registry.pages.map((page) => page.path));
  const byPath: Record<string, BacklinksRecord> = {};

  for (const page of registry.pages) {
    byPath[page.path] = { inbound: [], outbound: [] };
  }

  for (const page of registry.pages) {
    const outbound = page.linksOut.filter((target) => known.has(target));
    byPath[page.path].outbound = outbound;
    for (const target of outbound) {
      byPath[target] ??= { inbound: [], outbound: [] };
      byPath[target].inbound.push(page.path);
    }
  }

  for (const value of Object.values(byPath)) {
    value.inbound = [...new Set(value.inbound)].sort();
    value.outbound = [...new Set(value.outbound)].sort();
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    byPath,
  };
}

const PAGE_LABELS: Record<string, string> = {
  summary: "Summaries",
  topic: "Topics",
  plan: "Plans",
  review: "Reviews",
  workflow: "Workflows",
};

export async function enrichWithBacklinks(
  client: ObsidianClient,
  pages: RegistryEntry[],
): Promise<void> {
  for (const page of pages) {
    const backlinks = await client.backlinks(`Wiki/${page.path}`);
    const external = backlinks.filter(b => !b.file.startsWith("Wiki/"));
    page.externalBacklinks = external.length;
    page.externalSources = external
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(b => b.file);
  }
}

export function renderIndexMarkdown(registry: RegistryData, title = "Wiki"): string {
  const lines: string[] = [`# ${title} Index`, "", `Generated: ${registry.generatedAt}`, ""];
  for (const type of PAGE_ORDER) {
    const entries = registry.pages.filter((page) => page.type === type);
    const label = PAGE_LABELS[type] ?? capitalize(type);
    lines.push(`## ${label}`, "");
    if (entries.length === 0) {
      lines.push("_None yet._", "");
      continue;
    }

    for (const entry of entries) {
      const summary = entry.summary?.trim() ? ` — ${entry.summary.trim()}` : "";
      const sources = entry.sourceIds.length ? ` _(sources: ${entry.sourceIds.length})_` : "";
      lines.push(`- [[${entry.path.replace(/\.md$/, "")}|${entry.title}]]${summary}${sources}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export async function rebuildRegistryAndIndex(
  root: string,
  client?: ObsidianClient,
): Promise<{
  registry: RegistryData;
  backlinks: BacklinksData;
  rebuilt: string[];
}> {
  const config = await loadConfig(root);
  const pages = await scanWikiPages(root);
  const registry = buildRegistry(pages);
  const backlinks = buildBacklinks(registry);

  if (client) {
    await enrichWithBacklinks(client, registry.pages);
  }

  await mkdir(join(root, config.paths.meta), { recursive: true });
  await writeFile(metaPath(root, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  await writeFile(metaPath(root, "backlinks.json"), `${JSON.stringify(backlinks, null, 2)}\n`, "utf8");
  await writeFile(metaPath(root, "index.md"), renderIndexMarkdown(registry, config.title), "utf8");

  const edges = collectEdges(registry);
  await writeFile(metaPath(root, "edges.json"), `${JSON.stringify(edges, null, 2)}\n`, "utf8");
  await writeFile(metaPath(root, "edges.md"), renderEdgesMarkdown(edges), "utf8");

  return {
    registry,
    backlinks,
    rebuilt: [
      toRelative(root, metaPath(root, "registry.json")),
      toRelative(root, metaPath(root, "backlinks.json")),
      toRelative(root, metaPath(root, "index.md")),
      toRelative(root, metaPath(root, "edges.json")),
      toRelative(root, metaPath(root, "edges.md")),
    ],
  };
}

async function walkMarkdownFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walkMarkdownFiles(full)));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(full);
      }
    }
    return files.sort();
  } catch {
    return [];
  }
}

export function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function parseEdges(value: unknown): Edge[] {
  if (!Array.isArray(value)) return [];
  const edges: Edge[] = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.text !== "string" || !record.text.trim()) continue;
    edges.push({
      id: typeof record.id === "string" && record.id.trim() ? record.id : `edge-${index + 1}`,
      text: record.text.trim(),
      state: (typeof record.state === "string" && record.state.trim() ? record.state.trim() : "open") as Edge["state"],
      targets: arrayOfStrings(record.targets).length > 0 ? arrayOfStrings(record.targets) : undefined,
      created: asDateString(record.created),
      resolved_at: asDateString(record.resolved_at),
      pkb_ref: typeof record.pkb_ref === "string" && record.pkb_ref ? record.pkb_ref : undefined,
    });
  }
  return edges;
}

function asDateString(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  // gray-matter parses unquoted YAML dates into Date objects
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return undefined;
}

export function collectEdges(registry: RegistryData, now = Date.now()): EdgesData {
  const records: EdgeRecord[] = [];
  for (const page of registry.pages) {
    for (const edge of page.edges) {
      const created = edge.created ?? page.updated;
      const createdMs = created ? new Date(created).getTime() : NaN;
      records.push({
        pagePath: page.path,
        pageTitle: page.title,
        pageStatus: page.status,
        edgeId: edge.id,
        text: edge.text,
        state: edge.state,
        targets: edge.targets ?? [],
        created,
        resolvedAt: edge.resolved_at,
        pkbRef: edge.pkb_ref,
        daysSinceCreated: Number.isNaN(createdMs) ? 0 : Math.max(0, Math.floor((now - createdMs) / 86_400_000)),
      });
    }
  }

  const count = (state: string) => records.filter((record) => record.state === state).length;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    counts: {
      total: records.length,
      open: count("open"),
      exploring: count("exploring"),
      resolved: count("resolved"),
    },
    edges: records.sort((a, b) => b.daysSinceCreated - a.daysSinceCreated),
  };
}

const RECENTLY_RESOLVED_DAYS = 30;

export function renderEdgesMarkdown(data: EdgesData): string {
  const lines: string[] = [
    "# Edges — Learning Frontier",
    "",
    `Generated: ${data.generatedAt}`,
    "",
    `Open: ${data.counts.open} · Exploring: ${data.counts.exploring} · Resolved: ${data.counts.resolved}`,
    "",
    "Edges are knowledge-boundary questions recorded on summary pages. Open and exploring",
    "edges are the learning frontier; resolve them through graduation (recall) sessions.",
    "",
  ];

  const renderGroup = (heading: string, group: EdgeRecord[], empty: string) => {
    lines.push(`## ${heading}`, "");
    if (group.length === 0) {
      lines.push(empty, "");
      return;
    }
    let lastPage = "";
    for (const record of group) {
      if (record.pagePath !== lastPage) {
        lastPage = record.pagePath;
        lines.push(`### [[${record.pagePath.replace(/\.md$/, "")}|${record.pageTitle}]]`, "");
      }
      const age = record.daysSinceCreated > 0 ? ` _(${record.daysSinceCreated}d)_` : "";
      const targets = record.targets.length > 0 ? ` — targets: ${record.targets.join(", ")}` : "";
      lines.push(`- ${record.text}${age}${targets}`);
    }
    lines.push("");
  };

  const byPageAge = (a: EdgeRecord, b: EdgeRecord) =>
    a.pagePath.localeCompare(b.pagePath) || b.daysSinceCreated - a.daysSinceCreated;

  renderGroup(
    "Open edges",
    data.edges.filter((record) => record.state === "open").sort(byPageAge),
    "_No open edges._",
  );
  renderGroup(
    "Exploring",
    data.edges.filter((record) => record.state === "exploring").sort(byPageAge),
    "_No edges currently being explored._",
  );

  const recentlyResolved = data.edges
    .filter((record) => record.state === "resolved" && record.resolvedAt)
    .filter((record) => {
      const resolvedMs = new Date(record.resolvedAt as string).getTime();
      return !Number.isNaN(resolvedMs) && Date.now() - resolvedMs <= RECENTLY_RESOLVED_DAYS * 86_400_000;
    })
    .sort((a, b) => String(b.resolvedAt).localeCompare(String(a.resolvedAt)));

  lines.push("## Recently resolved (30 days)", "");
  if (recentlyResolved.length === 0) {
    lines.push("_None recently._", "");
  } else {
    for (const record of recentlyResolved) {
      const pkb = record.pkbRef ? ` → ${record.pkbRef}` : "";
      lines.push(`- ${record.text} — [[${record.pagePath.replace(/\.md$/, "")}|${record.pageTitle}]]${pkb}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function inferTypeFromPath(relativePath: string): WikiPageType {
  if (relativePath.includes("/summaries/")) return "summary";
  if (relativePath.includes("/topics/")) return "topic";
  if (relativePath.includes("/plans/")) return "plan";
  if (relativePath.includes("/workflows/")) return "workflow";
  return "review";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
