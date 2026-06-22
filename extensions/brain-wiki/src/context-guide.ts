import type {
  ContextGatherIntent,
  ExternalContextConfig,
  GraphContextResult,
} from "./types.ts";

export interface ExternalContextCatalogEntry {
  context_id: string;
  label: string;
  pkb_note: string;
  allowed_intents: ContextGatherIntent[];
}

export function normalizePkbNotePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/$/, "");
}

export function listConfiguredContexts(
  contexts: Record<string, ExternalContextConfig>,
): ExternalContextCatalogEntry[] {
  return Object.entries(contexts)
    .map(([context_id, context]) => ({
      context_id,
      label: context.label,
      pkb_note: context.pkb_note,
      allowed_intents: [...context.allowed_intents],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function findContextForPkbNote(
  contexts: Record<string, ExternalContextConfig>,
  path: string,
): ExternalContextCatalogEntry | undefined {
  const normalized = normalizePkbNotePath(path);
  const withoutMd = normalized.replace(/\.md$/i, "");

  for (const [context_id, context] of Object.entries(contexts)) {
    const note = normalizePkbNotePath(context.pkb_note);
    const noteWithoutMd = note.replace(/\.md$/i, "");
    if (
      note === normalized
      || noteWithoutMd === withoutMd
      || note === `${withoutMd}.md`
    ) {
      return {
        context_id,
        label: context.label,
        pkb_note: context.pkb_note,
        allowed_intents: [...context.allowed_intents],
      };
    }
  }

  return undefined;
}

export function formatExternalContextCatalog(
  entries: ExternalContextCatalogEntry[],
): string {
  if (entries.length === 0) {
    return "External contexts: none configured";
  }

  const lines = [
    "External contexts (PKB notes linked to local repositories):",
    "When repo-backed details are needed, call wiki_context_resolve then wiki_context_gather.",
    "Load skill map-external-context for setup and weaving protocol.",
    "",
  ];

  for (const entry of entries) {
    lines.push(`- ${entry.label} (${entry.context_id})`);
    lines.push(`  PKB: ${entry.pkb_note}`);
    lines.push(`  Intents: ${entry.allowed_intents.join(", ")}`);
    lines.push(
      `  Access: wiki_context_resolve({ pkb_note: "${entry.pkb_note}" }) → wiki_context_gather({ context_id: "${entry.context_id}", intent: "overview" })`,
    );
  }

  return lines.join("\n");
}

export function formatExternalContextHints(
  entries: ExternalContextCatalogEntry[],
): string {
  if (entries.length === 0) {
    return "";
  }

  const lines = [
    "External repo context available:",
  ];

  for (const entry of entries) {
    lines.push(
      `- ${entry.label}: wiki_context_resolve({ context_id: "${entry.context_id}" }) then wiki_context_gather with an allowed intent (${entry.allowed_intents.join(", ")})`,
    );
  }

  lines.push("Load skill map-external-context before gathering repo-backed details.");

  return lines.join("\n");
}

export function formatResolveNextSteps(contextId: string): string {
  return [
    "",
    "Next: wiki_context_gather with this context_id and a matching intent.",
    "Use overview or architecture without query; implementation and question require query.",
    `Example: wiki_context_gather({ context_id: "${contextId}", intent: "architecture" })`,
    "Load skill map-external-context for setup, intent choice, and weaving results.",
  ].join("\n");
}

export function appendExternalContextHintsToGraphFind(
  graphText: string,
  result: GraphContextResult,
  contexts: Record<string, ExternalContextConfig>,
): string {
  const matches = new Map<string, ExternalContextCatalogEntry>();

  for (const node of result.pkb) {
    const found = findContextForPkbNote(contexts, node.path);
    if (found) {
      matches.set(found.context_id, found);
    }
  }

  if (matches.size === 0) {
    return graphText;
  }

  return [graphText, "", formatExternalContextHints([...matches.values()])].join("\n");
}
