import { resolve } from "node:path";
import { analyzeToolMutation } from "./guards.ts";
import { isWithin } from "./paths.ts";

const pendingGraphBridgeRoots = new Set<string>();

export function markCaptureRequiresGraphBridge(root: string): void {
  pendingGraphBridgeRoots.add(root);
}

export function recordGraphDiscovery(root: string, hasTargets: boolean): void {
  if (hasTargets) {
    pendingGraphBridgeRoots.add(root);
    return;
  }

  pendingGraphBridgeRoots.delete(root);
}

export function clearGraphBridgeRequirement(root: string): void {
  pendingGraphBridgeRoots.delete(root);
}

export function hasPendingGraphBridge(root: string): boolean {
  return pendingGraphBridgeRoots.has(root);
}

export function shouldBlockWikiMutation(
  root: string,
  toolName: string,
  input: any,
  cwd: string,
): { block: boolean; reason?: string } {
  if (!pendingGraphBridgeRoots.has(root)) {
    return { block: false };
  }

  const analysis = analyzeToolMutation(root, toolName, input, cwd);
  const wikiPageRoot = resolve(root, "pages");
  const wikiPageMutations = analysis.allPaths.filter((path) =>
    isWithin(wikiPageRoot, path),
  );

  if (wikiPageMutations.length === 0) {
    return { block: false };
  }

  return {
    block: true,
    reason:
      "Run wiki_graph_traverse or wiki_graph_bridge before editing wiki pages after capture.",
  };
}

export function shouldBlockWikiPageCreate(
  root: string,
  wouldCreate: boolean,
): { block: boolean; reason?: string } {
  if (!pendingGraphBridgeRoots.has(root) || !wouldCreate) {
    return { block: false };
  }

  return {
    block: true,
    reason:
      "Run wiki_graph_traverse or wiki_graph_bridge before creating new wiki pages after capture.",
  };
}
