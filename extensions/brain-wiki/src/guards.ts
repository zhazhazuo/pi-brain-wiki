import { resolve } from "node:path";
import { generatedMetaFiles, isWithin, normalizeUserPath } from "./paths.ts";

interface GuardAnalysis {
  allPaths: string[];
  protectedPaths: string[];
  wikiPaths: string[];
  outsidePaths: string[];
}

export function analyzeToolMutation(root: string, toolName: string, input: any, cwd: string): GuardAnalysis {
  const allPaths = extractPaths(toolName, input, cwd);
  const protectedPaths = allPaths.filter((path) => isProtected(root, path));
  const wikiPaths = allPaths.filter((path) => isWithin(root, path));
  const outsidePaths = allPaths.filter(
    (path) => !isWithin(root, path) && !isProtected(root, path),
  );
  return { allPaths, protectedPaths, wikiPaths, outsidePaths };
}

function extractPaths(toolName: string, input: any, cwd: string): string[] {
  if (toolName === "write") {
    if (typeof input.path === "string") return [resolveFromCwd(cwd, input.path)];
    return [];
  }

  if (toolName !== "edit") return [];

  const paths = new Set<string>();
  if (typeof input.path === "string") {
    paths.add(resolveFromCwd(cwd, input.path));
  }

  if (Array.isArray(input.multi)) {
    for (const entry of input.multi) {
      const candidate = typeof entry.path === "string" ? entry.path : input.path;
      if (typeof candidate === "string") paths.add(resolveFromCwd(cwd, candidate));
    }
  }

  if (typeof input.patch === "string") {
    for (const patchPath of extractPathsFromPatch(input.patch)) {
      paths.add(resolveFromCwd(cwd, patchPath));
    }
  }

  return [...paths];
}

function extractPathsFromPatch(patch: string): string[] {
  const matches = patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm);
  return [...matches].map((match) => match[1].trim());
}

function isProtected(root: string, absolutePath: string): boolean {
  if (isWithin(resolve(root, "inbox"), absolutePath)) return true;
  return generatedMetaFiles(root).some((path) => resolve(path) === resolve(absolutePath));
}

function resolveFromCwd(cwd: string, value: string): string {
  return resolve(cwd, normalizeUserPath(value) ?? value);
}
