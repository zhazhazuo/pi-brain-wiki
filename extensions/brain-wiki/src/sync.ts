import { readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parsePage, setPageProperty } from "./frontmatter.ts";
import { toObsidianPath } from "./obsidian-io.ts";
import { areaRoot, metaPath, projectRoot, resourceRoot } from "./paths.ts";
import { ensureCanonicalPage } from "./scaffold.ts";
import { todayStamp } from "./slug.ts";
import type { RegistryData, RegistryEntry, SyncResult, SyncScope, WikiConfig } from "./types.ts";
import { ObsidianClient } from "./obsidian-client.ts";

interface ParaFolder {
  path: string;
  name: string;
  type: "area" | "resource" | "project";
}

export async function syncParaToWiki(
  root: string,
  config: WikiConfig,
  registry: RegistryData,
  scope: SyncScope,
  client?: ObsidianClient | null,
): Promise<SyncResult> {
  const folders = await scanParaFolders(root, scope, client);
  const liveRegistry: RegistryData = {
    ...registry,
    pages: [...registry.pages],
  };
  let topicsCreated = 0;
  let topicsUpdated = 0;
  const pages: string[] = [];
  const now = new Date().toISOString();
  const dateStamp = todayStamp(new Date());

  for (const folder of folders) {
    const result = await ensureCanonicalPage(root, config, liveRegistry, {
      type: folder.type === "project" ? "plan" : "topic",
      title: folder.name,
      createIfMissing: true,
    }, client);

    if (result.path) {
      updateLiveRegistry(liveRegistry, result);

      // Update last_synced and para_source on the page
      const absolutePath = join(root, result.path);
      const paraSource = relative(join(root, ".."), folder.path).replace(/\\/g, "/");
      const paraSources = await mergeParaSources(
        root,
        absolutePath,
        paraSource,
        client,
      );
      await setSyncProperties(absolutePath, dateStamp, paraSource, paraSources, client);

      pages.push(result.path);
      if (result.created) {
        topicsCreated++;
      } else if (result.resolved) {
        topicsUpdated++;
      }
    }
  }

  // Write sync state
  const syncState = {
    last_full_sync: now,
    scope,
    topicsCreated,
    topicsUpdated,
    pages,
  };
  await writeFile(metaPath(root, "sync-state.json"), `${JSON.stringify(syncState, null, 2)}\n`, "utf8");

  return { topicsCreated, topicsUpdated, pages };
}

async function scanParaFolders(
  root: string,
  scope: SyncScope,
  client?: ObsidianClient | null,
): Promise<ParaFolder[]> {
  const folders: ParaFolder[] = [];

  if (scope === "area" || scope === "all") {
    const areaFolders = await scanDirectory(areaRoot(root), "area", client);
    folders.push(...areaFolders);
  }

  if (scope === "resource" || scope === "all") {
    const resourceFolders = await scanDirectory(resourceRoot(root), "resource", client);
    folders.push(...resourceFolders);
  }

  if (scope === "projects" || scope === "all") {
    const projectFolders = await scanDirectory(projectRoot(root), "project", client);
    folders.push(...projectFolders);
  }

  return folders;
}

async function scanDirectory(
  dirPath: string,
  type: ParaFolder["type"],
  client?: ObsidianClient | null,
): Promise<ParaFolder[]> {
  const folders: ParaFolder[] = [];

  let entries: Array<{ name: string; isDir: boolean }>;

  if (client) {
    const rawEntries = await client.listDir(toObsidianPath(client, dirPath));
    entries = rawEntries.map((e) => ({ name: e.name, isDir: e.isDir }));
  } else {
    try {
      entries = await scanDirFilesystem(dirPath);
    } catch {
      // Directory may not exist.
      entries = [];
    }
  }

  for (const entry of entries) {
    if (entry.isDir) {
      folders.push({
        path: join(dirPath, entry.name),
        name: entry.name,
        type,
      });
    }
  }

  return folders;
}

async function scanDirFilesystem(dirPath: string): Promise<Array<{ name: string; isDir: boolean }>> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, isDir: true }));
}

function updateLiveRegistry(
  registry: RegistryData,
  result: Awaited<ReturnType<typeof ensureCanonicalPage>>,
): void {
  if (!result.path || !result.id || !result.title || !result.type) return;
  const existing = registry.pages.find((page) => page.path === result.path);
  if (existing) return;
  registry.pages.push({
    id: result.id,
    type: result.type as RegistryEntry["type"],
    path: result.path,
    title: result.title,
    aliases: [],
    tags: [],
    status: result.type === "topic" ? "draft" : "active",
    updated: todayStamp(new Date()),
    sourceIds: [],
    linksOut: [],
    headings: [],
    wordCount: 0,
    externalBacklinks: 0,
    externalSources: [],
  });
}

async function setSyncProperties(
  absolutePath: string,
  dateStamp: string,
  paraSource: string,
  paraSources: string[],
  client?: ObsidianClient | null,
): Promise<void> {
  if (client) {
    await setPageProperty(absolutePath, "last_synced", dateStamp, client);
    await setPageProperty(absolutePath, "para_source", paraSource, client);
    await setPageProperty(absolutePath, "para_sources", paraSources, client);
    return;
  }

  try {
    await setPageProperty(absolutePath, "last_synced", dateStamp);
    await setPageProperty(absolutePath, "para_source", paraSource);
    await setPageProperty(absolutePath, "para_sources", paraSources);
  } catch {
    // Skip pages that cannot be updated without a CLI client.
  }
}

async function mergeParaSources(
  root: string,
  absolutePath: string,
  nextSource: string,
  client?: ObsidianClient | null,
): Promise<string[]> {
  try {
    const page = await parsePage(root, absolutePath);
    const existing = Array.isArray(page.frontmatter.para_sources)
      ? page.frontmatter.para_sources.filter((item: unknown): item is string => typeof item === "string")
      : typeof page.frontmatter.para_source === "string"
        ? [page.frontmatter.para_source]
        : [];
    return [...new Set([...existing, nextSource])];
  } catch {
    // Fall back to only the current source if the page isn't readable yet.
  }
  return [nextSource];
}
