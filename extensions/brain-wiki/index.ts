import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { scanActivity } from "./src/activity.ts";
import { captureSource } from "./src/capture.ts";
import { loadConfig } from "./src/config.ts";
import { analyzeToolMutation } from "./src/guards.ts";
import { rebuildRegistryAndIndex } from "./src/indexer.ts";
import { runLint } from "./src/lint.ts";
import {
  appendEvent,
  markPageStatus,
  markSourcesIntegrated,
  readEvents,
  rebuildLog,
} from "./src/log.ts";
import {
  metaPath,
  lockPath,
  maybeResolveWikiRoot,
  resolveWikiRoot,
  toRelative,
} from "./src/paths.ts";
import { searchRegistry } from "./src/search.ts";
import { bootstrapVault, ensureCanonicalPage } from "./src/scaffold.ts";
import type {
  RegistryData,
  StatusSummary,
  WikiConfig,
  WikiEvent,
  WikiPageType,
} from "./src/types.ts";

const baseDir = dirname(fileURLToPath(import.meta.url));
const skillDir = join(baseDir, "resources", "skills");
const dirtyRoots = new Set<string>();

const PAGE_TYPE_ENUM = StringEnum([
  "summary",
  "topic",
  "plan",
  "review",
] as const);
const CANONICAL_TYPE_ENUM = StringEnum(["topic"] as const);
const LINT_MODE_ENUM = StringEnum([
  "links",
  "orphans",
  "frontmatter",
  "duplicates",
  "coverage",
  "staleness",
  "all",
] as const);
const EVENT_KIND_ENUM = StringEnum([
  "capture",
  "integrate",
  "query",
  "plan",
  "review",
  "lint",
  "refactor",
  "rebuild",
  "consumed",
  "archived",
  "cleared",
] as const);

export default function brainWikiExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", () => ({
    skillPaths: [
      join(skillDir, "brain-wiki", "SKILL.md"),
      join(skillDir, "wiki-map", "SKILL.md"),
      join(skillDir, "wiki-workshop", "SKILL.md"),
      join(skillDir, "wiki-intel", "SKILL.md"),
      join(skillDir, "recall", "SKILL.md"),
    ],
  }));

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit")
      return undefined;

    const root = await maybeResolveWikiRoot(ctx.cwd);
    if (!root) return undefined;

    const analysis = analyzeToolMutation(
      root,
      event.toolName,
      event.input,
      ctx.cwd,
    );
    if (analysis.protectedPaths.length > 0) {
      const protectedList = analysis.protectedPaths
        .map((path) => toRelative(root, path))
        .join(", ");
      if (ctx.hasUI)
        ctx.ui.notify(
          `Blocked protected wiki path(s): ${protectedList}`,
          "warning",
        );
      return {
        block: true,
        reason: `brain-wiki protects these paths: ${protectedList}`,
      };
    }

    if (analysis.outsidePaths.length > 0) {
      const outsideList = analysis.outsidePaths
        .map((path) => toRelative(root, path))
        .join(", ");
      if (ctx.hasUI)
        ctx.ui.notify(
          `Blocked write outside wiki: ${outsideList}. Write into Wiki/ instead — the user is responsible for content outside the wiki.`,
          "warning",
        );
      return {
        block: true,
        reason: `brain-wiki restricts agent writes to the wiki domain. Write into Wiki/ instead of: ${outsideList}`,
      };
    }

    if (analysis.wikiPaths.length > 0) {
      dirtyRoots.add(root);
    }

    return undefined;
  });

  pi.on("agent_end", async (_event, ctx) => {
    for (const root of [...dirtyRoots]) {
      try {
        await withRootLock(root, async () => {
          await rebuildAllGeneratedArtifacts(root);
        });
        dirtyRoots.delete(root);
      } catch (error) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            `brain-wiki rebuild failed: ${(error as Error).message}`,
            "error",
          );
        }
      }
    }
  });

  pi.registerTool({
    name: "wiki_bootstrap",
    label: "Wiki Bootstrap",
    description:
      "Initialize a brain-wiki vault in the current directory or a specified root path.",
    promptSnippet:
      "Initialize the brain-wiki folder structure, config, templates, schema, and generated metadata files",
    promptGuidelines: [
      "Use this tool before any other brain-wiki workflow when the current project is not bootstrapped yet.",
    ],
    parameters: Type.Object({
      rootPath: Type.Optional(
        Type.String({
          description: "Optional root directory for the wiki vault",
        }),
      ),
      title: Type.String({ description: "Human-readable wiki title" }),
      domain: Type.Optional(
        Type.String({ description: "Short description of the wiki domain" }),
      ),
      force: Type.Optional(
        Type.Boolean({
          description: "Overwrite scaffold files if the wiki already exists",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = resolve(ctx.cwd, params.rootPath ?? ".");
      const created = await bootstrapVault(
        root,
        params.title,
        params.domain,
        params.force ?? false,
      );
      await withRootLock(root, async () => {
        await rebuildAllGeneratedArtifacts(root);
      });
      return {
        content: [{ type: "text", text: `Initialized brain-wiki at ${root}` }],
        details: {
          rootPath: root,
          created,
          configPath: join(root, ".wiki", "config.json"),
        },
      };
    },
  });

  pi.registerTool({
    name: "wiki_capture_source",
    label: "Wiki Capture Source",
    description:
      "Capture a URL, file, or pasted text into an immutable source packet and scaffold a source page.",
    promptSnippet:
      "Capture a new source into inbox/ and create a summary page before integrating it into topic pages",
    promptGuidelines: [
      "Use this tool when a user supplies a URL, local file, PDF, webpage, transcript, or pasted text that should become part of the wiki.",
      "After capture, read the source page before updating canonical pages.",
    ],
    parameters: Type.Object({
      inputType: StringEnum(["url", "file", "text"] as const),
      value: Type.String({
        description: "The URL, file path, or raw text to capture",
      }),
      title: Type.Optional(
        Type.String({ description: "Optional override title" }),
      ),
      kind: Type.Optional(
        Type.String({
          description:
            "Optional source kind, e.g. article, paper, note, transcript",
        }),
      ),
      tags: Type.Optional(Type.Array(Type.String({ description: "Tag" }))),
      createSourcePage: Type.Optional(
        Type.Boolean({
          description: "Whether to create a summary page (default true)",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const config = await loadConfig(root);
      return withRootLock(root, async () => {
        const result = await captureSource(
          root,
          ctx.cwd,
          config,
          params,
          {
            exec: (command, args, options) => pi.exec(command, args, options),
          },
          signal,
        );

        await appendEvent(root, {
          ts: new Date().toISOString(),
          kind: "capture",
          title: `Captured ${result.title}`,
          sourceIds: [result.sourceId],
          pagePaths: result.sourcePagePath
            ? [result.sourcePagePath]
            : undefined,
          actor: "extension",
          notes: [`inputType=${params.inputType}`],
        });

        await rebuildAllGeneratedArtifacts(root);

        return {
          content: [
            {
              type: "text",
              text: `Captured ${result.sourceId}: ${result.title}`,
            },
          ],
          details: result,
        };
      });
    },
  });

  pi.registerTool({
    name: "wiki_search",
    label: "Wiki Search",
    description:
      "Search the compiled wiki registry by title, alias, summary, headings, path, tags, and source ids.",
    promptSnippet:
      "Search the wiki registry for relevant pages before reading or editing markdown files directly",
    promptGuidelines: [
      "Use this tool first for query and integration workflows so you update existing pages instead of creating duplicates.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      type: Type.Optional(PAGE_TYPE_ENUM),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of matches to return" }),
      ),
      includeArchived: Type.Optional(
        Type.Boolean({
          description: "Include archived and cleared entries in results (default: false)",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const registry = await loadRegistry(root);
      const excludeStatuses = params.includeArchived
        ? []
        : ["archived", "cleared"];
      const result = await searchRegistry(
        root,
        registry,
        params.query,
        params.type as WikiPageType | undefined,
        params.limit,
        excludeStatuses,
      );
      return {
        content: [{ type: "text", text: formatSearch(result) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "wiki_ensure_page",
    label: "Wiki Ensure Page",
    description:
      "Resolve an existing canonical page by title or alias, or create it safely from a template if missing.",
    promptSnippet:
      "Resolve or create canonical topic pages without duplicating titles or aliases",
    promptGuidelines: [
      "Use this tool before creating a new canonical page in pages/topics.",
    ],
    parameters: Type.Object({
      type: CANONICAL_TYPE_ENUM,
      title: Type.String({ description: "Page title" }),
      aliases: Type.Optional(Type.Array(Type.String({ description: "Alias" }))),
      tags: Type.Optional(Type.Array(Type.String({ description: "Tag" }))),
      summary: Type.Optional(
        Type.String({ description: "Optional one-line summary" }),
      ),
      date: Type.Optional(
        Type.String({ description: "Date for plan pages: YYYY-MM-DD" }),
      ),
      period: Type.Optional(
        Type.String({ description: "Period for review pages: YYYY-Www" }),
      ),
      createIfMissing: Type.Optional(
        Type.Boolean({
          description: "Create page if not found (default true)",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const config = await loadConfig(root);
      return withRootLock(root, async () => {
        const registry = await loadRegistry(root);
        const result = await ensureCanonicalPage(root, config, registry, {
          ...params,
          createIfMissing: params.createIfMissing ?? true,
        });

        if (result.created && result.path) {
          await appendEvent(root, {
            ts: new Date().toISOString(),
            kind: "refactor",
            title: `Created ${result.type} page ${result.title}`,
            pagePaths: [result.path],
            actor: "extension",
          });
          await rebuildAllGeneratedArtifacts(root);
        }

        return {
          content: [{ type: "text", text: formatEnsurePage(result) }],
          details: result,
        };
      });
    },
  });

  pi.registerTool({
    name: "wiki_lint",
    label: "Wiki Lint",
    description:
      "Run deterministic structural lint checks over the wiki, including links, orphans, frontmatter, duplicates, coverage, and staleness.",
    promptSnippet:
      "Run deterministic health checks over wiki structure and generated metadata",
    promptGuidelines: [
      "Use this tool before a semantic audit when you want a mechanical health report of the wiki.",
    ],
    parameters: Type.Object({
      mode: Type.Optional(LINT_MODE_ENUM),
      writeReport: Type.Optional(
        Type.Boolean({ description: "Write meta/lint-report.md" }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of issues to return" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const result = await runLint(
        root,
        params.mode ?? "all",
        params.writeReport ?? true,
        params.limit,
      );
      return {
        content: [{ type: "text", text: formatLint(result) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "wiki_status",
    label: "Wiki Status",
    description:
      "Show a quick operational dashboard for the wiki, including page counts, source states, and recent events.",
    promptSnippet:
      "Inspect the wiki's current operational status and recent activity",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const status = await buildStatus(root);
      return {
        content: [{ type: "text", text: formatStatus(status) }],
        details: status,
      };
    },
  });

  pi.registerTool({
    name: "wiki_log_event",
    label: "Wiki Log Event",
    description:
      "Append a structured event to meta/events.jsonl, regenerate meta/log.md, and optionally mark captured sources as integrated.",
    promptSnippet:
      "Record structured wiki events such as capture, integrate, query, plan, review, lint, refactor, and rebuild",
    promptGuidelines: [
      "Use this tool after integration when you want the chronology preserved in meta/events.jsonl and meta/log.md.",
      "If you pass kind=integrate and sourceIds, the corresponding source packets and source pages are marked integrated.",
    ],
    parameters: Type.Object({
      kind: EVENT_KIND_ENUM,
      title: Type.String({ description: "Short event title" }),
      summary: Type.Optional(
        Type.String({ description: "Optional event summary" }),
      ),
      sourceIds: Type.Optional(
        Type.Array(Type.String({ description: "Source ID" })),
      ),
      pagePaths: Type.Optional(
        Type.Array(
          Type.String({
            description: "Relative page path, e.g. pages/topics/foo.md",
          }),
        ),
      ),
      notes: Type.Optional(
        Type.Array(Type.String({ description: "Additional note" })),
      ),
      actor: Type.Optional(StringEnum(["agent", "user", "extension"] as const)),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const config = await loadConfig(root);
      return withRootLock(root, async () => {
        const ts = new Date().toISOString();
        const event: WikiEvent = {
          ts,
          kind: params.kind,
          title: params.title,
          summary: params.summary,
          sourceIds: params.sourceIds,
          pagePaths: params.pagePaths,
          notes: params.notes,
          actor: params.actor ?? "agent",
        };
        await appendEvent(root, event);
        if (params.kind === "integrate" && params.sourceIds?.length) {
          await markSourcesIntegrated(root, params.sourceIds, ts);
          await rebuildAllGeneratedArtifacts(root);
        } else if (params.kind === "consumed" && params.pagePaths?.length) {
          const pkbRefs = (params.notes ?? []).filter((n) => n.startsWith("pkb:")).map((n) => n.slice(4));
          await markPageStatus(root, params.pagePaths, "consumed", {
            consumed_at: ts,
            pkb_refs: pkbRefs.length > 0 ? pkbRefs : undefined,
          });
          await rebuildAllGeneratedArtifacts(root);
        } else if (params.kind === "archived" && params.pagePaths?.length) {
          await markPageStatus(root, params.pagePaths, "archived", {});
          await rebuildAllGeneratedArtifacts(root);
        } else if (params.kind === "cleared" && params.pagePaths?.length) {
          await markPageStatus(root, params.pagePaths, "cleared", {
            cleared_at: new Date().toISOString(),
          });
          await rebuildAllGeneratedArtifacts(root);
        } else {
          await rebuildLog(root, config.title);
        }
        return {
          content: [
            { type: "text", text: `Logged ${params.kind}: ${params.title}` },
          ],
          details: {
            eventTs: ts,
            eventPath: "meta/events.jsonl",
            logPath: "meta/log.md",
          },
        };
      });
    },
  });

  pi.registerTool({
    name: "wiki_rebuild_meta",
    label: "Wiki Rebuild Meta",
    description:
      "Force a full rescan of wiki pages and regenerate registry, backlinks, index, and log files.",
    promptSnippet: "Force-rescan the wiki and rebuild generated metadata files",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      return withRootLock(root, async () => {
        const rebuilt = await rebuildAllGeneratedArtifacts(root);
        return {
          content: [{ type: "text", text: `Rebuilt metadata for ${root}` }],
          details: { rebuilt },
        };
      });
    },
  });

  pi.registerTool({
    name: "wiki_scan_activity",
    label: "Wiki Scan Activity",
    description:
      "Scan vault and wiki activity for a given period. Returns structured data for the Intelligence agent.",
    promptSnippet: "Scan recent activity across the wiki and vault",
    parameters: Type.Object({
      since: Type.Optional(
        Type.String({
          description: "ISO date to scan from (default: 7 days ago)",
        }),
      ),
      scope: Type.Optional(StringEnum(["wiki", "vault", "both"] as const)),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const vaultRoot = resolve(root, ".."); // Wiki/ is inside the vault
      const result = await scanActivity(root, vaultRoot, {
        since: params.since,
        scope: params.scope ?? "both",
      });
      return {
        content: [{ type: "text", text: formatActivity(result) }],
        details: result,
      };
    },
  });

  pi.registerCommand("wiki-status", {
    description: "Show a short brain-wiki status summary",
    handler: async (_args, ctx) => {
      const root = await resolveWikiRoot(ctx.cwd);
      const status = await buildStatus(root);
      ctx.ui.notify(formatStatus(status), "info");
    },
  });

  pi.registerCommand("wiki-lint", {
    description: "Run brain-wiki mechanical lint. Usage: /wiki-lint [mode]",
    handler: async (args, ctx) => {
      const root = await resolveWikiRoot(ctx.cwd);
      const mode = (args?.trim() || "all") as Parameters<typeof runLint>[1];
      const result = await runLint(root, mode, true, 50);
      ctx.ui.notify(
        formatLint(result),
        result.counts.total === 0 ? "info" : "warning",
      );
    },
  });

  pi.registerCommand("wiki-rebuild", {
    description: "Force a full brain-wiki metadata rebuild",
    handler: async (_args, ctx) => {
      const root = await resolveWikiRoot(ctx.cwd);
      await withRootLock(root, async () => {
        await rebuildAllGeneratedArtifacts(root);
      });
      ctx.ui.notify("brain-wiki metadata rebuilt", "info");
    },
  });

  pi.registerCommand("wiki-consumed", {
    description:
      "Mark wiki pages as consumed by PKB. Usage: /wiki-consumed <page-path> <pkb-ref-1> [pkb-ref-2] ...",
    handler: async (args, ctx) => {
      const root = await resolveWikiRoot(ctx.cwd);
      const parts = (args ?? "").trim().split(/\s+/);
      if (parts.length < 2 || !parts[0]) {
        ctx.ui.notify(
          "Usage: /wiki-consumed <page-path> <pkb-ref-1> [pkb-ref-2] ...",
          "warning",
        );
        return;
      }
      const pagePath = parts[0];
      const pkbRefs = parts.slice(1);

      return withRootLock(root, async () => {
        const ts = new Date().toISOString();
        await appendEvent(root, {
          ts,
          kind: "consumed",
          title: `Consumed ${pagePath}`,
          pagePaths: [pagePath],
          notes: pkbRefs.map((ref) => `pkb:${ref}`),
          actor: "user",
        });
        await markPageStatus(root, [pagePath], "consumed", {
          consumed_at: ts,
          pkb_refs: pkbRefs,
        });
        await rebuildAllGeneratedArtifacts(root);
        ctx.ui.notify(
          `Marked ${pagePath} as consumed (PKB: ${pkbRefs.join(", ")})`,
          "info",
        );
      });
    },
  });
}

async function withRootLock<T>(
  root: string,
  task: () => Promise<T>,
): Promise<T> {
  return withFileMutationQueue(lockPath(root), task);
}

async function rebuildAllGeneratedArtifacts(root: string): Promise<string[]> {
  const config = await loadConfig(root);
  const { rebuilt } = await rebuildRegistryAndIndex(root);
  const logPath = await rebuildLog(root, config.title);
  return [...rebuilt, logPath];
}

async function loadRegistry(root: string): Promise<RegistryData> {
  try {
    const raw = await readFile(metaPath(root, "registry.json"), "utf8");
    return JSON.parse(raw) as RegistryData;
  } catch {
    const rebuilt = await rebuildRegistryAndIndex(root);
    return rebuilt.registry;
  }
}

async function buildStatus(root: string): Promise<StatusSummary> {
  const registry = await loadRegistry(root);
  const events = await readEvents(root);
  const totals = {
    allPages: registry.pages.length,
    summary: registry.pages.filter((page) => page.type === "summary").length,
    topic: registry.pages.filter((page) => page.type === "topic").length,
    plan: registry.pages.filter((page) => page.type === "plan").length,
    review: registry.pages.filter((page) => page.type === "review").length,
  };
  const sources = registry.pages.filter((page) => page.type === "summary");
  const captured = sources.filter((page) => page.status === "captured").length;
  const integrated = sources.filter(
    (page) => page.status === "integrated",
  ).length;
  const consumed = sources.filter((page) => page.status === "consumed").length;
  const archived = sources.filter((page) => page.status === "archived").length;
  const cleared = sources.filter((page) => page.status === "cleared").length;

  const integratedEntries = sources.filter((page) => page.status === "integrated" && page.updated);
  const oldestIntegrated = integratedEntries.length > 0
    ? integratedEntries.reduce((oldest, entry) => entry.updated! < oldest ? entry.updated! : oldest, integratedEntries[0].updated!)
    : undefined;

  return {
    totals,
    sources: {
      captured,
      integrated,
      unintegrated: captured,
      consumed,
      archived,
      cleared,
    },
    lastCapture: [...events].reverse().find((event) => event.kind === "capture")
      ?.ts,
    lastEvent: events.at(-1)?.ts,
    oldestIntegrated,
  };
}

function formatSearch(
  result: Awaited<ReturnType<typeof searchRegistry>>,
): string {
  if (result.matches.length === 0)
    return `No wiki matches for: ${result.query}`;
  return [
    `Top matches for: ${result.query}`,
    ...result.matches.map(
      (match) =>
        `- [${match.score}] ${match.title} (${match.type}) — ${match.path}`,
    ),
  ].join("\n");
}

function formatEnsurePage(result: {
  resolved: boolean;
  created: boolean;
  conflict: boolean;
  path?: string;
  title?: string;
  candidates?: Array<{ path: string; title: string }>;
}): string {
  if (result.conflict) {
    return `Conflict: multiple pages matched. Candidates: ${(result.candidates ?? []).map((candidate) => candidate.path).join(", ")}`;
  }
  if (!result.resolved) return "No matching page found.";
  if (result.created) return `Created page: ${result.path}`;
  return `Resolved existing page: ${result.path}`;
}

function formatLint(result: Awaited<ReturnType<typeof runLint>>): string {
  return [
    `Lint mode: ${result.mode}`,
    `Total issues: ${result.counts.total}`,
    `brokenLinks=${result.counts.brokenLinks} orphans=${result.counts.orphans} frontmatter=${result.counts.frontmatter}`,
    `duplicates=${result.counts.duplicates} coverage=${result.counts.coverage} staleness=${result.counts.staleness}`,
    ...(result.reportPath ? [`Report: ${result.reportPath}`] : []),
  ].join("\n");
}

function formatStatus(status: StatusSummary): string {
  return [
    `Pages: ${status.totals.allPages} total (${status.totals.summary} summary, ${status.totals.topic} topic, ${status.totals.plan} plan, ${status.totals.review} review)`,
    `Sources: ${status.sources.captured} captured, ${status.sources.integrated} integrated, ${status.sources.consumed} consumed, ${status.sources.archived} archived, ${status.sources.cleared} cleared`,
    ...(status.oldestIntegrated ? [`Oldest unintegrated: ${status.oldestIntegrated}`] : []),
    ...(status.lastCapture ? [`Last capture: ${status.lastCapture}`] : []),
    ...(status.lastEvent ? [`Last event: ${status.lastEvent}`] : []),
  ].join("\n");
}

function formatActivity(
  result: Awaited<ReturnType<typeof scanActivity>>,
): string {
  const lines: string[] = [
    `Activity: ${result.period.since} → ${result.period.until}`,
    ``, // empty string
  ];
  // Wiki activity
  lines.push(`Wiki pages: ${result.wikiActivity.totalPages} total`);
  if (Object.keys(result.wikiActivity.pagesByStatus).length > 0) {
    const statusStr = Object.entries(result.wikiActivity.pagesByStatus)
      .map(([s, n]) => `${s}: ${n}`)
      .join(", ");
    lines.push(`Page statuses: ${statusStr}`);
  }
  lines.push(`Events in period: ${result.wikiActivity.recentEvents.length}`);
  lines.push(
    `Recent page changes: ${result.wikiActivity.recentPageChanges.length}`,
  );

  // Vault activity
  if (result.vaultActivity) {
    lines.push(`\nVault changes:`);
    lines.push(
      `  Project/: ${result.vaultActivity.recentProjectChanges.length} files`,
    );
    lines.push(
      `  Resource/: ${result.vaultActivity.recentResourceChanges.length} files`,
    );
    lines.push(
      `  Draft/: ${result.vaultActivity.recentDraftChanges.length} files`,
    );
    lines.push(`  LIST.md items: ${result.vaultActivity.listItems.length}`);
  }

  // Projects
  if (result.projects && result.projects.length > 0) {
    lines.push(`\nProjects:`);
    for (const p of result.projects) {
      lines.push(
        `  ${p.title} — ${p.status}, ${p.priority} priority` +
          (p.deadline ? `, deadline: ${p.deadline}` : "") +
          (p.lastAction ? `, last action: ${p.lastAction}` : ""),
      );
    }
  }

  // Git
  if (result.gitLog) {
    lines.push(`\nGit commits in period: ${result.gitLog.commits}`);
  } else {
    lines.push(`\nGit log: not available (not a git repo or git not found)`);
  }

  // Lifecycle backlog
  if (result.lifecycle) {
    lines.push(`\nLifecycle backlog:`);
    if (result.lifecycle.integratedAwaitingRecall.length > 0) {
      lines.push(`  Awaiting Recall: ${result.lifecycle.integratedAwaitingRecall.length} entries`);
      for (const entry of result.lifecycle.integratedAwaitingRecall.slice(0, 5)) {
        lines.push(`    - ${entry.title} (${entry.daysSinceIntegration}d since integration)`);
      }
    } else {
      lines.push(`  Awaiting Recall: none`);
    }
    if (result.lifecycle.consumedReactivated.length > 0) {
      lines.push(`  Reactivated (consumed with new sources): ${result.lifecycle.consumedReactivated.length} entries`);
    }
    if (result.lifecycle.clearableCandidates.length > 0) {
      lines.push(`  Clearable: ${result.lifecycle.clearableCandidates.length} archived entries`);
    } else {
      lines.push(`  Clearable: none`);
    }
  }

  return lines.join("\n");
}
