import { readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { setPageProperty } from "./frontmatter.ts";
import { toObsidianPath } from "./obsidian-io.ts";
import { areaRoot, metaPath, projectRoot, resourceRoot } from "./paths.ts";
import { ensureCanonicalPage } from "./scaffold.ts";
import { todayStamp } from "./slug.ts";
import type { RegistryData, SyncResult, SyncScope, WikiConfig } from "./types.ts";
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
  let topicsCreated = 0;
  let topicsUpdated = 0;
  const pages: string[] = [];
  const now = new Date().toISOString();
  const dateStamp = todayStamp(new Date());

  for (const folder of folders) {
    const result = await ensureCanonicalPage(root, config, registry, {
      type: folder.type === "project" ? "plan" : "topic",
      title: folder.name,
      createIfMissing: true,
    }, client);

    if (result.path) {
      // Update last_synced and para_source on the page
      const absolutePath = join(root, result.path);
      const paraSource = relative(join(root, ".."), folder.path).replace(/\\/g, "/");
      if (client) {
        await setPageProperty(absolutePath, "last_synced", dateStamp, client);
        await setPageProperty(absolutePath, "para_source", paraSource, client);
      } else {
        try {
          await setPageProperty(absolutePath, "last_synced", dateStamp);
          await setPageProperty(absolutePath, "para_source", paraSource);
        } catch {
          // Skip pages that cannot be updated without a CLI client.
        }
      }

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
