import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { areaRoot, projectRoot, resourceRoot } from "./paths.ts";
import { ensureCanonicalPage } from "./scaffold.ts";
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

  for (const folder of folders) {
    const result = await ensureCanonicalPage(root, config, registry, {
      type: folder.type === "project" ? "plan" : "topic",
      title: folder.name,
      createIfMissing: true,
    });

    if (result.created) {
      topicsCreated++;
      if (result.path) pages.push(result.path);
    } else if (result.resolved) {
      topicsUpdated++;
      if (result.path) pages.push(result.path);
    }
  }

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

  try {
    let entries: Array<{ name: string; isDir: boolean }>;

    if (client) {
      try {
        const rawEntries = await client.listDir(dirPath);
        entries = rawEntries.map((e) => ({ name: e.name, isDir: e.isDir }));
      } catch {
        // Fallback to filesystem
        entries = await scanDirFilesystem(dirPath);
      }
    } else {
      entries = await scanDirFilesystem(dirPath);
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
  } catch {
    // Directory may not exist
  }

  return folders;
}

async function scanDirFilesystem(dirPath: string): Promise<Array<{ name: string; isDir: boolean }>> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, isDir: true }));
}
