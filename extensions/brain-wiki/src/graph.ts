import type { ObsidianClient } from "./obsidian-client.ts";
import type {
  GraphBridgeResult,
  GraphContextResult,
  GraphNeighborhood,
  GraphNodeCandidate,
  GraphZone,
} from "./types.ts";

export async function findGraphContext(
  client: ObsidianClient,
  terms: string[],
  limit = 12,
): Promise<GraphContextResult> {
  const query = terms.map((term) => term.trim()).filter(Boolean).join(" ");
  const rawHits = await searchVault(client, query, limit);
  const hits = dedupeFiles(rawHits);
  const candidates = await Promise.all(hits.map((file, index) => buildCandidate(client, file, index)));
  const valid = candidates.filter((candidate): candidate is GraphNodeCandidate => candidate !== null);
  return {
    query,
    wiki: valid.filter((candidate) => candidate.zone === "wiki"),
    pkb: valid.filter((candidate) => candidate.zone === "pkb"),
  };
}

export async function traverseNeighborhood(
  client: ObsidianClient,
  path: string,
  hops = 1,
): Promise<GraphNeighborhood> {
  const title = inferTitle(path);
  const backlinks = await client.backlinks(path);
  const links = await safeLinks(client, path);

  if (hops <= 1) {
    return { path, title, backlinks, links, secondHop: [] };
  }

  const secondHop = new Map<string, number>();
  for (const backlink of backlinks) {
    const neighborBacklinks = await client.backlinks(backlink.file);
    for (const entry of neighborBacklinks) {
      if (entry.file === path) continue;
      secondHop.set(entry.file, Math.max(secondHop.get(entry.file) ?? 0, Number(entry.count ?? 1)));
    }
  }

  return {
    path,
    title,
    backlinks,
    links,
    secondHop: [...secondHop.entries()]
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)),
  };
}

export async function bridgeWikiPage(
  client: ObsidianClient,
  pagePath: string,
  limit = 8,
): Promise<GraphBridgeResult> {
  const content = await client.readFile(pagePath);
  const title = inferTitle(pagePath);
  const terms = buildEnsurePageGraphTerms(title, extractSummaryLine(content));
  const context = await findGraphContext(client, terms, limit);
  const currentLinks = await safeLinks(client, pagePath);
  const linked = new Set(currentLinks);
  const candidates = [...context.pkb, ...context.wiki]
    .filter((candidate) => candidate.path !== pagePath)
    .filter((candidate) => !linked.has(candidate.path));

  return {
    pagePath,
    title,
    terms,
    currentLinks,
    candidates: candidates.slice(0, limit),
  };
}

export function buildEnsurePageGraphTerms(title: string, summary?: string): string[] {
  return [title, summary].filter((part): part is string => Boolean(part?.trim()));
}

export function renderPkbContextBlock(nodes: Array<{ path: string; title: string }>): string {
  if (nodes.length === 0) return "";
  return [
    "## PKB Context",
    "",
    ...nodes.map((node) => `- [[${node.path.replace(/\.md$/i, "")}|${node.title}]]`),
    "",
  ].join("\n");
}

export function formatGraphFind(result: GraphContextResult): string {
  const lines = [`Graph discovery for: ${result.query}`];
  lines.push("");
  lines.push("Found in Wiki:");
  if (result.wiki.length === 0) {
    lines.push("- _None_");
  } else {
    for (const node of result.wiki) {
      lines.push(`- [[${node.path.replace(/\.md$/i, "")}|${node.title}]]`);
    }
  }
  lines.push("");
  lines.push("Found in PKB:");
  if (result.pkb.length === 0) {
    lines.push("- _None_");
  } else {
    for (const node of result.pkb) {
      lines.push(`- [[${node.path.replace(/\.md$/i, "")}|${node.title}]]`);
    }
  }
  return lines.join("\n");
}

async function buildCandidate(
  client: ObsidianClient,
  file: string,
  index: number,
): Promise<GraphNodeCandidate | null> {
  const properties = await safeProperties(client, file);
  const zone: GraphZone = file.startsWith("Wiki/") ? "wiki" : "pkb";
  const title = typeof properties.title === "string" ? properties.title : inferTitle(file);
  const summary = typeof properties.summary === "string" ? properties.summary : undefined;
  const aliases = stringArray(properties.aliases);
  const tags = stringArray(properties.tags);
  const sourceIds = stringArray(properties.source_ids);
  const backlinks = await client.backlinks(file).then((entries) => entries.reduce((sum, entry) => sum + Number(entry.count ?? 1), 0)).catch(() => 0);

  return {
    path: file,
    title,
    summary,
    aliases,
    tags,
    sourceIds,
    zone,
    score: Math.max(0, 100 - index * 10),
    backlinks,
  };
}

async function searchVault(
  client: ObsidianClient,
  query: string,
  limit: number,
): Promise<Array<{ file: string } | string>> {
  try {
    const result = await client.search(query, { limit, format: "json" });
    return Array.isArray(result) ? result : [];
  } catch {
    const result = await client.search(query, { limit });
    return Array.isArray(result) ? result : [];
  }
}

function dedupeFiles(hits: Array<{ file: string } | string>): string[] {
  const seen = new Set<string>();
  const files: string[] = [];
  for (const hit of hits) {
    const file = typeof hit === "string" ? hit : hit.file;
    if (!file || seen.has(file)) continue;
    seen.add(file);
    files.push(file);
  }
  return files;
}

async function safeProperties(client: ObsidianClient, file: string): Promise<Record<string, any>> {
  try {
    return await client.properties(file, { format: "json" });
  } catch {
    return {};
  }
}

async function safeLinks(client: ObsidianClient, file: string): Promise<string[]> {
  try {
    return await client.links(file);
  } catch {
    return [];
  }
}

function inferTitle(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

function extractSummaryLine(content: string): string | undefined {
  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => !line.startsWith("#") && !line.startsWith("---"));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
