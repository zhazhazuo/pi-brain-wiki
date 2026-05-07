import { access } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { CanonicalPageType } from "./types.ts";

export const CONFIG_PATH = join(".wiki", "config.json");

// Common subdirectory names under which a vault may be rooted (checked at each level)
const VAULT_SUBDIRS = [".", "Wiki", "wiki"];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function normalizeUserPath(value?: string): string | undefined {
  if (!value) return value;
  return value.startsWith("@") ? value.slice(1) : value;
}

export async function resolveWikiRoot(cwd: string, explicitRoot?: string): Promise<string> {
  if (explicitRoot) {
    const root = resolve(cwd, normalizeUserPath(explicitRoot)!);
    if (await exists(join(root, CONFIG_PATH))) return root;
    throw new Error(`No .wiki/config.json found at ${root}`);
  }

  let current = resolve(cwd);
  while (true) {
    // Check each vault-subdirectory name at this level
    for (const subdir of VAULT_SUBDIRS) {
      const candidate = subdir === "." ? current : join(current, subdir);
      if (await exists(join(candidate, CONFIG_PATH))) return candidate;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error(`Could not find .wiki/config.json from ${cwd} upward`);
}

export async function maybeResolveWikiRoot(cwd: string, explicitRoot?: string): Promise<string | undefined> {
  try {
    return await resolveWikiRoot(cwd, explicitRoot);
  } catch {
    return undefined;
  }
}

export function resolveFrom(base: string, maybeRelative: string): string {
  const normalized = normalizeUserPath(maybeRelative) ?? maybeRelative;
  return isAbsolute(normalized) ? normalized : resolve(base, normalized);
}

export function toRelative(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split("\\").join("/");
}

export function isWithin(parent: string, target: string): boolean {
  const rel = relative(resolve(parent), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function sourcePacketDir(root: string, sourceId: string): string {
  return join(root, "inbox", sourceId);
}

export function sourcePagePath(root: string, sourceId: string, titleSlug?: string): string {
  if (titleSlug) {
    return join(root, "pages", "summaries", `${titleSlug}.md`);
  }
  return join(root, "pages", "summaries", `${sourceId}.md`);
}

export function canonicalDir(root: string, type: CanonicalPageType): string {
  // All canonical types map to pages/{type}s/
  return join(root, "pages", `${type}s`);
}

export function canonicalPagePath(root: string, type: CanonicalPageType, slug: string, dateStamp?: string, period?: string): string {
  // topic: Topic-Name.md
  // plan: YYYY-MM-DD-Plan.md (dateStamp = today)
  // review: YYYY-Www-Review.md (period = ISO week)
  if (type === "plan") {
    return join(canonicalDir(root, type), `${dateStamp ?? "plan"}-Plan.md`);
  }
  if (type === "review") {
    return join(canonicalDir(root, type), `${period ?? "review"}-Review.md`);
  }
  return join(canonicalDir(root, type), `${slug}.md`);
}

export function metaPath(root: string, name: string): string {
  return join(root, "meta", name);
}

export function lockPath(root: string): string {
  return join(root, ".wiki", ".brain-wiki.lock");
}

export function normalizeWikiLinkTarget(target: string): string | undefined {
  const clean = target.trim().replace(/\\/g, "/").replace(/\.md$/i, "");
  if (!clean) return undefined;

  // Wiki-internal links: summaries/, topics/, plans/, reviews/
  if (
    clean.startsWith("summaries/") ||
    clean.startsWith("topics/") ||
    clean.startsWith("plans/") ||
    clean.startsWith("reviews/")
  ) {
    return `pages/${clean}.md`;
  }

  // PARA links (Resource/, Project/, Area/, Archive/, Draft/) are external — don't flag
  if (
    clean.startsWith("Resource/") ||
    clean.startsWith("Project/") ||
    clean.startsWith("Area/") ||
    clean.startsWith("Archive/") ||
    clean.startsWith("Draft/")
  ) {
    // Return clean PARA path — linter should NOT flag these
    return undefined;
  }

  return undefined;
}

export function generatedMetaFiles(root: string): string[] {
  return [
    metaPath(root, "registry.json"),
    metaPath(root, "backlinks.json"),
    metaPath(root, "events.jsonl"),
    metaPath(root, "index.md"),
    metaPath(root, "log.md"),
    metaPath(root, "lint-report.md"),
  ];
}

// ── PARA Vault Path Helpers ────────────────────────────────────

export function vaultRoot(wikiRoot: string): string {
  return resolve(wikiRoot, "..");
}

export function areaRoot(wikiRoot: string): string {
  return join(vaultRoot(wikiRoot), "Area");
}

export function projectRoot(wikiRoot: string): string {
  return join(vaultRoot(wikiRoot), "Project");
}

export function resourceRoot(wikiRoot: string): string {
  return join(vaultRoot(wikiRoot), "Resource");
}

export function draftRoot(wikiRoot: string): string {
  return join(vaultRoot(wikiRoot), "Draft");
}

export function listMdPath(wikiRoot: string): string {
  return join(vaultRoot(wikiRoot), "LIST.md");
}
