import { loadConfig } from "./config.ts";
import type { ObsidianClient } from "./obsidian-client.ts";
import type { RegistryData, RegistryEntry, SearchHit, SearchMatch, SearchResult, WikiPageType } from "./types.ts";

export function resolveSearchScope(scope?: "wiki" | "vault"): "wiki" | "vault" {
  return scope ?? "wiki";
}

export async function searchRegistry(
  root: string,
  registry: RegistryData,
  query: string,
  type?: WikiPageType,
  limit?: number,
  excludeStatuses?: string[],
): Promise<SearchResult> {
  const config = await loadConfig(root);
  const normalized = query.trim().toLowerCase();
  const tokens = tokenize(normalized);

  const matches = registry.pages
    .filter((entry) => !type || entry.type === type)
    .filter((entry) => {
      if (!excludeStatuses || excludeStatuses.length === 0) return true;
      return !excludeStatuses.includes(entry.status ?? "");
    })
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, normalized, tokens),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit ?? config.search.defaultLimit)
    .map<SearchMatch>(({ entry, score }) => ({
      id: entry.id,
      type: entry.type,
      path: entry.path,
      title: entry.title,
      summary: entry.summary,
      aliases: entry.aliases,
      score,
      sourceIds: entry.sourceIds,
    }));

  return { query, matches };
}

function scoreEntry(entry: RegistryData["pages"][number], normalizedQuery: string, tokens: string[]): number {
  let score = 0;
  const title = entry.title.toLowerCase();
  const aliases = entry.aliases.map((alias) => alias.toLowerCase());
  const summary = (entry.summary ?? "").toLowerCase();
  const headings = entry.headings.map((heading) => heading.toLowerCase());
  const path = entry.path.toLowerCase();
  const sourceIds = entry.sourceIds.map((id) => id.toLowerCase());
  const tags = entry.tags.map((tag) => tag.toLowerCase());

  if (title === normalizedQuery) score += 120;
  if (aliases.includes(normalizedQuery)) score += 110;
  if (path.includes(normalizedQuery)) score += 40;
  if (summary.includes(normalizedQuery)) score += 50;
  if (headings.some((heading) => heading.includes(normalizedQuery))) score += 35;
  if (sourceIds.includes(normalizedQuery)) score += 45;

  for (const token of tokens) {
    if (!token) continue;
    if (title.includes(token)) score += 18;
    if (aliases.some((alias) => alias.includes(token))) score += 14;
    if (summary.includes(token)) score += 8;
    if (headings.some((heading) => heading.includes(token))) score += 6;
    if (tags.some((tag) => tag.includes(token))) score += 4;
    if (sourceIds.some((id) => id.includes(token))) score += 5;
    if (path.includes(token)) score += 3;
  }

  return score;
}

export async function searchViaObsidian(
  client: ObsidianClient,
  registry: RegistryData,
  query: string,
  type?: WikiPageType,
  limit?: number,
  excludeStatuses?: string[],
  scope: "wiki" | "vault" = "wiki",
): Promise<SearchResult> {
  const resolvedScope = resolveSearchScope(scope);
  const TYPE_DIR: Record<string, string> = {
    summary: "pages/summaries",
    topic: "pages/topics",
    plan: "pages/plans",
    review: "pages/reviews",
    workflow: "pages/workflows",
  };

  const excl = new Set(excludeStatuses ?? []);
  const byPath = buildRegistryLookup(registry);

  if (resolvedScope === "vault") {
    const raw = await searchVault(client, query, limit ?? 10);
    const matches: Array<SearchMatch | null> = await Promise.all(
      dedupeSearchResults(raw).map(async (hit, index) => {
        const entry = byPath.get(hit.file);
        if (entry && excl.has(entry.status ?? "")) return null;

        if (entry) {
          return {
            id: entry.id,
            type: entry.type,
            path: entry.path,
            title: entry.title,
            summary: entry.summary,
            aliases: entry.aliases,
            score: Math.max(0, 100 - index * 10),
            sourceIds: entry.sourceIds,
          } satisfies SearchMatch;
        }

        const props = await client.properties(hit.file, { format: "json" }).catch(() => ({} as Record<string, any>));
        const title = typeof props.title === "string"
          ? props.title
          : inferTitleFromPath(hit.file);
        const summary = typeof props.summary === "string" ? props.summary : undefined;
        const aliases = Array.isArray(props.aliases) ? props.aliases.filter((item): item is string => typeof item === "string") : [];
        const sourceIds = Array.isArray(props.source_ids) ? props.source_ids.filter((item): item is string => typeof item === "string") : [];
        const status = typeof props.status === "string" ? props.status : undefined;

        if (excl.has(status ?? "")) return null;

        return {
          id: hit.file,
          type: inferTypeFromPath(hit.file, props.tags),
          path: hit.file,
          title,
          summary,
          aliases,
          score: Math.max(0, 100 - index * 10),
          sourceIds,
        } satisfies SearchMatch;
      })
    );

    return { query, matches: matches.filter((item): item is SearchMatch => item !== null) };
  }

  const wikiScope = type ? `Wiki/${TYPE_DIR[type]}` : "Wiki";
  const hits = await client.searchContext(query, { path: wikiScope, limit: limit ?? 10 });
  const matches: SearchMatch[] = [];

  for (let i = 0; i < dedupeSearchResults(hits).length; i++) {
    const hit = dedupeSearchResults(hits)[i];
    const entry = byPath.get(hit.file);
    if (!entry) continue;
    if (excl.has(entry.status ?? "")) continue;

    matches.push({
      id: entry.id,
      type: entry.type,
      path: entry.path,
      title: entry.title,
      summary: entry.summary,
      aliases: entry.aliases,
      score: Math.max(0, 100 - i * 10),
      sourceIds: entry.sourceIds,
    });
  }

  return { query, matches };
}

function tokenize(input: string): string[] {
  return [...new Set(input.split(/[^a-z0-9]+/).map((part) => part.trim()).filter(Boolean))];
}

async function searchVault(client: ObsidianClient, query: string, limit: number): Promise<Array<{ file: string } | string>> {
  try {
    const result = await client.search(query, { limit, format: "json" });
    return Array.isArray(result) ? result : [];
  } catch {
    const result = await client.search(query, { limit });
    return Array.isArray(result) ? result : [];
  }
}

function dedupeSearchResults(hits: Array<SearchHit | { file: string } | string>): Array<{ file: string }> {
  const seen = new Set<string>();
  const deduped: Array<{ file: string }> = [];
  for (const hit of hits) {
    const file = typeof hit === "string" ? hit : hit.file;
    if (!file || seen.has(file)) continue;
    seen.add(file);
    deduped.push({ file });
  }
  return deduped;
}

function buildRegistryLookup(registry: RegistryData): Map<string, RegistryEntry> {
  const byPath = new Map<string, RegistryEntry>();
  for (const entry of registry.pages) {
    byPath.set(`Wiki/${entry.path}`, entry);
    byPath.set(entry.path, entry);
  }
  return byPath;
}

function inferTitleFromPath(file: string): string {
  const last = file.split("/").pop() ?? file;
  return last.replace(/\.md$/i, "");
}

function inferTypeFromPath(file: string, tags: unknown): string {
  if (file.startsWith("Wiki/")) return "wiki";
  if (file.startsWith("Area/")) return "area";
  if (file.startsWith("Project/")) return "project";
  if (file.startsWith("Resource/")) return "resource";
  if (Array.isArray(tags) && tags.some((tag) => typeof tag === "string" && tag.toUpperCase() === "RESOURCE")) {
    return "resource";
  }
  return "pkb";
}
