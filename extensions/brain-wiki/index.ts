import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { scanActivity } from "./src/activity.ts";
import { captureSource, listCaptureStates, updateCaptureState } from "./src/capture.ts";
import { rebuildDigest } from "./src/digest.ts";
import { loadConfig } from "./src/config.ts";
import { gatherExternalContext } from "./src/context-gather.ts";
import { runRepoGatherAgent } from "./src/context-gather-agent.ts";
import {
  analyzeExternalRepoAccess,
  formatExternalRepoAccessBlock,
} from "./src/context-guards.ts";
import {
  appendExternalContextHintsToGraphFind,
  formatExternalContextCatalog,
  formatResolveNextSteps,
  listConfiguredContexts,
} from "./src/context-guide.ts";
import { resolveExternalContext } from "./src/context-resolve.ts";
import { analyzeToolMutation } from "./src/guards.ts";
import { rebuildRegistryAndIndex } from "./src/indexer.ts";
import { integrateCapturedSource } from "./src/integration.ts";
import { runLint } from "./src/lint.ts";
import {
  bridgeWikiPage,
  findGraphContext,
  formatGraphFind,
  traverseNeighborhood,
} from "./src/graph.ts";
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
import {
  clearGraphBridgeRequirement,
  hasPendingGraphBridge,
  markCaptureRequiresGraphBridge,
  recordGraphDiscovery,
  shouldBlockWikiPageCreate,
  shouldBlockWikiMutation,
} from "./src/workflow-gate.ts";
import { type searchRegistry, searchViaObsidian } from "./src/search.ts";
import { ObsidianClient } from "./src/obsidian-client.ts";
import { bootstrapVault, ensureCanonicalPage } from "./src/scaffold.ts";
import { syncParaToWiki } from "./src/sync.ts";
import { triageList } from "./src/triage.ts";
import { syncProject } from "./src/project-sync.ts";
import { createWorkflow, rebuildWorkflowRoutes } from "./src/workflow.ts";
import type {
  ProjectSyncResult,
  RegistryData,
  ScanProposal,
  StatusSummary,
  TriageResult,
  WorkflowParams,
  WorkflowResult,
  WikiConfig,
  WikiEvent,
  WikiPageType,
} from "./src/types.ts";
import { taskExec, taskExport } from "./src/task-cli.ts";
import { validatePromotion } from "./src/task-validator.ts";
import { renderWeekMd, writeWeekMd } from "./src/wiki-week.ts";
import { scanVaultForTasks } from "./src/task-scan.ts";
import {
  markListItemPromoted,
  syncCompletedTasksToList,
} from "./src/task-sync.ts";
import { getPackageSkillPaths } from "./src/skills.ts";

const dirtyRoots = new Set<string>();

let cachedClient: ObsidianClient | null = null;

async function getObsidianClient(root: string): Promise<ObsidianClient | null> {
  if (cachedClient) return cachedClient;
  const vaultCwd = resolve(root, "..");
  const client = new ObsidianClient({
    socketPath: join(homedir(), ".obsidian-cli.sock"),
    vaultCwd,
    timeout: 10000,
  });
  if (await client.ping()) {
    cachedClient = client;
    return client;
  }
  return null;
}

async function requireObsidianClient(root: string): Promise<ObsidianClient> {
  const client = await getObsidianClient(root);
  if (!client) {
    throw new Error(
      "Obsidian CLI is required for this wiki vault operation. Start Obsidian with CLI support enabled and try again.",
    );
  }
  return client;
}

const PAGE_TYPE_ENUM = StringEnum([
  "summary",
  "topic",
  "plan",
  "review",
  "workflow",
] as const);
const CANONICAL_TYPE_ENUM = StringEnum(["topic"] as const);
const WORKFLOW_STATUS_ENUM = StringEnum([
  "draft",
  "active",
  "archived",
] as const);
const LINT_MODE_ENUM = StringEnum([
  "links",
  "orphans",
  "frontmatter",
  "duplicates",
  "coverage",
  "staleness",
  "graph",
  "all",
] as const);
const CONTEXT_INTENT_ENUM = StringEnum([
  "overview",
  "architecture",
  "implementation",
  "recent_changes",
  "question",
  "handoff",
] as const);
const EVENT_KIND_ENUM = StringEnum([
  "capture",
  "integrate",
  "query",
  "plan",
  "review",
  "workflow",
  "lint",
  "refactor",
  "rebuild",
  "consumed",
  "archived",
  "cleared",
] as const);

const priorityMap: Record<string, "H" | "M" | "L"> = {
  IU: "H",
  I: "M",
  U: "L",
};

export default function brainWikiExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", () => ({
    skillPaths: getPackageSkillPaths(),
  }));

  pi.on("tool_call", async (event, ctx) => {
    const externalRepoBlock = await analyzeExternalRepoAccess(ctx.cwd, event.toolName, event.input);
    if (externalRepoBlock) {
      const reason = formatExternalRepoAccessBlock(externalRepoBlock);
      if (ctx.hasUI) ctx.ui.notify(reason, "warning");
      return { block: true, reason };
    }

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

    const workflowBlock = shouldBlockWikiMutation(
      root,
      event.toolName,
      event.input,
      ctx.cwd,
    );

    if (workflowBlock.block) {
      if (ctx.hasUI) ctx.ui.notify(workflowBlock.reason ?? "Blocked wiki mutation", "warning");
      return {
        block: true,
        reason: workflowBlock.reason ?? "wiki graph bridge required before editing wiki pages",
      };
    }

    if (analysis.protectedPaths.length > 0) {
      const protectedList = analysis.protectedPaths
        .map((path) => toRelative(root, path))
        .join(", ");
      if (ctx.hasUI)
        ctx.ui.notify(`Blocked protected path(s): ${protectedList}`, "warning");
      return {
        block: true,
        reason: `brain-wiki protects Area/ from agent writes: ${protectedList}`,
      };
    }

    // Mark root dirty for any write/edit operation to trigger meta rebuild
    dirtyRoots.add(root);

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
      "Capture a new source into inbox/, then discover related pages with vault search and graph tools before integrating it",
    promptGuidelines: [
      "Use this tool when a user supplies a URL, local file, PDF, webpage, transcript, or pasted text that should become part of the wiki.",
      "After capture, use the returned sourcePagePath directly. Do not use bash, find, or grep to rediscover captured artifacts.",
      "Read the source page before updating canonical pages.",
      "Before revising summary or topic pages, run wiki_search with scope=vault and then wiki_graph_find on the main terms.",
      "Use wiki_graph_bridge or wiki_graph_traverse when a candidate page already exists.",
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
      const client = await requireObsidianClient(root);
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
          client,
        );

        markCaptureRequiresGraphBridge(root);

        await appendEvent(
          root,
          {
            ts: new Date().toISOString(),
            kind: "capture",
            title: `Captured ${result.title}`,
            sourceIds: [result.sourceId],
            pagePaths: result.sourcePagePath
              ? [result.sourcePagePath]
              : undefined,
            actor: "extension",
            notes: [`inputType=${params.inputType}`],
          },
          client,
        );

        await rebuildAllGeneratedArtifacts(root);

        return {
          content: [
            {
              type: "text",
              text: [
                `Captured ${result.sourceId}: ${result.title}`,
                result.sourcePagePath
                  ? `Source page: ${vaultRelative(ctx.cwd, root, result.sourcePagePath)}`
                  : "Source page: not created",
                "Next: open the source page, then run wiki_search scope=vault and wiki_graph_find before editing summary or topic pages.",
                "Do not use bash, find, or grep to locate the captured packet or summary page.",
              ].join("\n"),
            },
          ],
          details: result,
        };
      });
    },
  });

  pi.registerTool({
    name: "wiki_integrate_source",
    label: "Wiki Integrate Source",
    description:
      "Finalize a captured source after graph work by marking the source packet, summary page, and selected topic pages as integrated.",
    promptSnippet:
      "Integrate a captured source only after graph discovery or bridging has identified concrete target pages",
    promptGuidelines: [
      "Run wiki_search, wiki_graph_find, wiki_graph_traverse, or wiki_graph_bridge before calling this tool.",
      "Provide the sourceId and at least one concrete target page path.",
      "Use this tool to transition the source state from integration_pending to integrated.",
    ],
    parameters: Type.Object({
      sourceId: Type.String({ description: "Captured source ID, e.g. SRC-2026-06-16-001" }),
      pagePaths: Type.Array(
        Type.String({
          description: "Target page path to mark integrated, e.g. pages/topics/example.md",
        }),
        { minItems: 1 },
      ),
      notes: Type.Optional(
        Type.Array(Type.String({ description: "Optional note for the integration event" })),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const client = await getObsidianClient(root);
      return withRootLock(root, async () => {
        const result = await integrateCapturedSource(root, params.sourceId, {
          pagePaths: params.pagePaths,
          notes: params.notes,
          client,
        });
        await updateCaptureState(root, params.sourceId, {
          status: "integrated",
          integratedAt: result.integratedAt,
          targetPagePaths: params.pagePaths,
        });
        await rebuildAllGeneratedArtifacts(root);
        return {
          content: [
            {
              type: "text",
              text: [
                `Integrated ${params.sourceId}`,
                `Targets: ${params.pagePaths.join(", ")}`,
                `Integrated at: ${result.integratedAt}`,
              ].join("\n"),
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
      "Search the full vault first, or the wiki registry for exact wiki lookup, by title, alias, summary, headings, path, tags, and source ids.",
    promptSnippet:
      "Search the full vault for entry points before reading or editing markdown files directly",
    promptGuidelines: [
      "Default to scope=vault for discovery.",
      "Use scope=wiki only when you need registry-only wiki lookup.",
      "Use this tool before editing so you update existing pages instead of creating duplicates.",
      "If a capture tool already returned a sourcePagePath, use that path directly instead of shell discovery.",
      "When a PKB hit matches a configured external context (see wiki_context_list or wiki_status), and Walker needs repo-backed implementation or architecture details, call wiki_context_resolve then wiki_context_gather.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      scope: Type.Optional(StringEnum(["wiki", "vault"] as const)),
      type: Type.Optional(PAGE_TYPE_ENUM),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of matches to return" }),
      ),
      includeArchived: Type.Optional(
        Type.Boolean({
          description:
            "Include archived and cleared entries in results (default: false)",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const client = await requireObsidianClient(root);
      const registry = await loadRegistry(root);
      const excludeStatuses = params.includeArchived
        ? []
        : ["archived", "cleared"];
      const result = await searchViaObsidian(
        client,
        registry,
        params.query,
        params.type as WikiPageType | undefined,
        params.limit,
        excludeStatuses,
        params.scope ?? "vault",
      );
      return {
        content: [{ type: "text", text: formatSearch(result, ctx.cwd, root) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "wiki_graph_find",
    label: "Wiki Graph Find",
    description:
      "Discover related wiki and PKB nodes across the vault before writing or revising knowledge.",
    promptSnippet:
      "Discover related wiki and PKB nodes across the vault before writing or revising knowledge",
    promptGuidelines: [
      "Use this after vault search to identify nearby nodes.",
      "Use terms from the source title, summary, or topic query.",
      "Do not use bash, find, or grep to locate candidate pages when search and graph tools can answer the question.",
      "When PKB hits include a configured external context, follow the External repo context hints and call wiki_context_resolve before gathering codebase details.",
    ],
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "Search query" })),
      terms: Type.Optional(
        Type.Array(Type.String({ description: "Query term" })),
      ),
      limit: Type.Optional(Type.Number({ description: "Maximum matches" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const config = await loadConfig(root);
      const client = await requireObsidianClient(root);
      const terms = (params.terms?.length ? params.terms : [params.query ?? ""]).filter(Boolean);
      const result = await findGraphContext(client, terms, params.limit ?? 12);
      recordGraphDiscovery(
        root,
        result.wiki.length + result.pkb.length > 0,
      );
      const text = appendExternalContextHintsToGraphFind(
        formatGraphFind(result),
        result,
        config.contexts,
      );
      return {
        content: [{ type: "text", text }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "wiki_graph_traverse",
    label: "Wiki Graph Traverse",
    description:
      "Inspect the neighborhood of a vault node using backlinks and outgoing links.",
    promptSnippet:
      "Inspect the neighborhood of a vault node using backlinks and outgoing links",
    promptGuidelines: [
      "Use this when a candidate page already exists and you need nearby context.",
      "Treat the returned page path as authoritative; do not rediscover it with shell commands.",
    ],
    parameters: Type.Object({
      path: Type.String({ description: "Vault file path" }),
      hops: Type.Optional(Type.Number({ description: "Neighborhood depth" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const client = await requireObsidianClient(root);
      const result = await traverseNeighborhood(client, params.path, params.hops ?? 1);
      clearGraphBridgeRequirement(root);
      return {
        content: [
          {
            type: "text",
            text: [
              `Neighborhood for ${result.title}`,
              `Backlinks: ${result.backlinks.length}`,
              `Outgoing links: ${result.links.length}`,
              `Second hop: ${result.secondHop.length}`,
            ].join("\n"),
          },
        ],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "wiki_graph_bridge",
    label: "Wiki Graph Bridge",
    description:
      "Find likely missing PKB or wiki connections for an existing wiki page.",
    promptSnippet:
      "Find likely missing PKB or wiki connections for an existing wiki page",
    promptGuidelines: [
      "Use this before editing a page to find what should be connected next.",
      "Do not shell-search for the page or its neighbors; use the pagePath and graph output directly.",
    ],
    parameters: Type.Object({
      pagePath: Type.String({ description: "Wiki page path" }),
      limit: Type.Optional(Type.Number({ description: "Maximum matches" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const client = await requireObsidianClient(root);
      const result = await bridgeWikiPage(client, params.pagePath, params.limit ?? 8);
      clearGraphBridgeRequirement(root);
      return {
        content: [
          {
            type: "text",
            text: [
              `Bridge candidates for ${result.title}`,
              `Current links: ${result.currentLinks.length}`,
              `Candidates: ${result.candidates.length}`,
            ].join("\n"),
          },
        ],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "wiki_context_list",
    label: "Wiki Context List",
    description:
      "List configured PKB-linked external repository contexts and how to access them with wiki_context_resolve and wiki_context_gather.",
    promptSnippet:
      "List configured external repo contexts before resolving or gathering repo-backed PKB details",
    promptGuidelines: [
      "Use this when Walker asks about linked codebases, brain_wiki_context, or repo-backed context for a PKB note.",
      "After listing, call wiki_context_resolve for the matching context_id or pkb_note, then wiki_context_gather with an allowed intent.",
      "Load skill map-external-context for setup, intent choice, and weaving results into wiki/PKB reasoning.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const config = await loadConfig(root);
      const entries = listConfiguredContexts(config.contexts);
      return {
        content: [{ type: "text", text: formatExternalContextCatalog(entries) }],
        details: { contexts: entries },
      };
    },
  });

  pi.registerTool({
    name: "wiki_context_resolve",
    label: "Wiki Context Resolve",
    description:
      "Resolve an external context descriptor from a configured context id or PKB note.",
    promptSnippet:
      "Resolve an external repo context before gathering implementation or handoff details",
    promptGuidelines: [
      "Call this before wiki_context_gather whenever repo-backed details are needed for a configured PKB note.",
      "Pass context_id from brain_wiki_context frontmatter or pkb_note from the PKB path.",
      "If resolve fails, run wiki_context_list to inspect configured contexts or load skill map-external-context for setup.",
    ],
    parameters: Type.Object({
      context_id: Type.Optional(
        Type.String({ description: "Configured external context id" }),
      ),
      pkb_note: Type.Optional(
        Type.String({ description: "PKB note path mapped to an external context" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const result = await resolveExternalContext(root, params);
      return {
        content: [
          {
            type: "text",
            text: [
              `Resolved external context: ${result.label}`,
              `Context ID: ${result.context_id}`,
              `Repo: ${result.repo_path}`,
              `Allowed intents: ${result.allowed_intents.join(", ")}`,
              formatResolveNextSteps(result.context_id),
            ].join("\n"),
          },
        ],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "wiki_context_gather",
    label: "Wiki Context Gather",
    description:
      "Gather bounded external repository context for overview, architecture, implementation, changes, or handoff work.",
    promptSnippet:
      "Gather bounded external repo context using a resolved context id and intent",
    promptGuidelines: [
      "Call wiki_context_resolve first unless you already have a validated context_id.",
      "This tool runs an isolated Pi agent inside the resolved repository and returns a structured brief.",
      "Do not use read, grep, find, ls, or bash against the external repository path from the parent wiki session.",
      "Pick intent from Walker's goal: overview, architecture, implementation, recent_changes, question, or handoff.",
      "Pass query for implementation and question intents.",
      "Load skill map-external-context to weave the returned brief into wiki or PKB reasoning.",
    ],
    parameters: Type.Object({
      context_id: Type.String({ description: "Configured external context id" }),
      intent: CONTEXT_INTENT_ENUM,
      query: Type.Optional(
        Type.String({ description: "Focused query for implementation or question gathers" }),
      ),
      limit_commits: Type.Optional(
        Type.Number({ description: "Optional max recent commits to include" }),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const resolved = await resolveExternalContext(root, {
        context_id: params.context_id,
      });
      const result = await gatherExternalContext(resolved, {
        intent: params.intent,
        query: params.query,
        readTextFile: (path) => readFile(path, "utf8"),
        execCommand: (command, args) =>
          pi.exec(command, adjustContextGatherArgs(command, args, params.limit_commits), {
            cwd: resolved.repo_path,
          }),
        runRepoAgent: (input) => runRepoGatherAgent({
          ...input,
          signal,
          onUpdate: onUpdate
            ? (brief) => onUpdate({
              content: [{ type: "text", text: brief }],
              details: { phase: "repo-gather-agent", context_id: resolved.context_id },
            })
            : undefined,
        }),
      });
      const agentBrief = result.evidence.find((entry) => entry.kind === "agent");
      return {
        content: [
          {
            type: "text",
            text: [
              `External context gather: ${resolved.label}`,
              `Intent: ${result.intent}`,
              agentBrief && agentBrief.kind === "agent"
                ? agentBrief.brief
                : result.summary.join("\n"),
              "",
              "Parent session: use this brief only. Do not read the external repository directly.",
            ].join("\n"),
          },
        ],
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
      "Use search and graph discovery first, then resolve or create the canonical page.",
      "Do not use shell discovery to find an existing canonical page when search or graph output already identified it.",
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
      const client = await requireObsidianClient(root);
      return withRootLock(root, async () => {
        const registry = await loadRegistry(root);
        const resolveOnly = await ensureCanonicalPage(
          root,
          config,
          registry,
          {
            ...params,
            createIfMissing: false,
          },
          client,
        );

        const pageWouldCreate = !resolveOnly.resolved && (params.createIfMissing ?? true);
        const creationBlock = shouldBlockWikiPageCreate(root, pageWouldCreate);
        if (creationBlock.block) {
          throw new Error(creationBlock.reason ?? "wiki graph bridge required before creating new wiki pages");
        }

        const result =
          resolveOnly.resolved || params.createIfMissing === false
            ? resolveOnly
            : await ensureCanonicalPage(
                root,
                config,
                registry,
                {
                  ...params,
                  createIfMissing: true,
                },
                client,
              );

        if (result.created && result.path) {
          await appendEvent(
            root,
            {
              ts: new Date().toISOString(),
              kind: "refactor",
              title: `Created ${result.type} page ${result.title}`,
              pagePaths: [result.path],
              actor: "extension",
            },
            client,
          );
          await rebuildAllGeneratedArtifacts(root);
        }

        return {
          content: [
            { type: "text", text: formatEnsurePage(result, ctx.cwd, root) },
          ],
          details: result,
        };
      });
    },
  });

  pi.registerTool({
    name: "wiki_generate_workflow",
    label: "Wiki Generate Workflow",
    description:
      "Create a standardized workflow page from structured inputs so learned workflows follow the wiki workflow schema.",
    promptSnippet:
      "Generate a new workflow page after the user approves a proposed learned workflow",
    promptGuidelines: [
      "Use this tool only after proposing the extracted workflow and receiving user approval.",
      "Pass concise triggers that future agents can match against user intent.",
      "Use status='draft' unless the user explicitly approved activating the workflow.",
    ],
    parameters: Type.Object({
      title: Type.String({ description: "Workflow title" }),
      status: Type.Optional(WORKFLOW_STATUS_ENUM),
      triggers: Type.Array(
        Type.String({
          description: "User phrasing that should route to this workflow",
        }),
      ),
      goal: Type.String({
        description: "What the workflow helps the user accomplish",
      }),
      inputs: Type.Array(
        Type.String({
          description:
            "Required input source, e.g. recent activity or OKR pages",
        }),
      ),
      steps: Type.Array(
        Type.String({ description: "Ordered workflow step instruction" }),
      ),
      output: Type.String({
        description: "Expected final output format",
      }),
      constraints: Type.Optional(
        Type.Array(Type.String({ description: "Workflow constraint" })),
      ),
      tags: Type.Optional(Type.Array(Type.String({ description: "Tag" }))),
      summary: Type.Optional(
        Type.String({ description: "Short route-page description" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const client = await requireObsidianClient(root);
      return withRootLock(root, async () => {
        const registry = await loadRegistry(root);
        const result = await createWorkflow(
          root,
          registry,
          params as WorkflowParams,
          client,
        );

        if (result.created && result.path) {
          await appendEvent(
            root,
            {
              ts: new Date().toISOString(),
              kind: "workflow",
              title: `Generated workflow ${result.title}`,
              pagePaths: [result.path],
              actor: "extension",
              notes: [
                `status=${result.status}`,
                `triggers=${params.triggers.join(", ")}`,
              ],
            },
            client,
          );
          await rebuildAllGeneratedArtifacts(root);
        }

        return {
          content: [
            { type: "text", text: formatWorkflowResult(result, ctx.cwd, root) },
          ],
          details: result,
        };
      });
    },
  });

  pi.registerTool({
    name: "wiki_lint",
    label: "Wiki Lint",
    description:
      "Run deterministic health checks, including page-type conformance rules, over the wiki: links, orphans, frontmatter, duplicates, coverage, and staleness.",
    promptSnippet:
      "Run deterministic health checks, including page-type conformance rules, over wiki structure and generated metadata",
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
      const client = await requireObsidianClient(root);
      const result = await runLint(
        root,
        params.mode ?? "all",
        params.writeReport ?? true,
        params.limit,
        client,
      );
      return {
        content: [{ type: "text", text: formatLint(result, ctx.cwd, root) }],
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
      const client = await getObsidianClient(root);
      return withRootLock(root, async () => {
        if (params.kind === "integrate" && hasPendingGraphBridge(root)) {
          throw new Error(
            "Run wiki_graph_traverse or wiki_graph_bridge before logging integration for a captured source.",
          );
        }

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
          const requiredClient = client ?? (await requireObsidianClient(root));
          await markSourcesIntegrated(
            root,
            params.sourceIds,
            ts,
            requiredClient,
          );
          await Promise.all(
            params.sourceIds.map((sourceId) =>
              updateCaptureState(root, sourceId, {
                status: "integrated",
                integratedAt: ts,
              }),
            ),
          );
          await rebuildAllGeneratedArtifacts(root);
        } else if (params.kind === "consumed" && params.pagePaths?.length) {
          const pkbRefs = (params.notes ?? [])
            .filter((n) => n.startsWith("pkb:"))
            .map((n) => n.slice(4));
          const requiredClient = client ?? (await requireObsidianClient(root));
          await markPageStatus(
            root,
            params.pagePaths,
            "consumed",
            {
              consumed_at: ts,
              pkb_refs: pkbRefs.length > 0 ? pkbRefs : undefined,
            },
            requiredClient,
          );
          await rebuildAllGeneratedArtifacts(root);
        } else if (params.kind === "archived" && params.pagePaths?.length) {
          const requiredClient = client ?? (await requireObsidianClient(root));
          await markPageStatus(
            root,
            params.pagePaths,
            "archived",
            {},
            requiredClient,
          );
          await rebuildAllGeneratedArtifacts(root);
        } else if (params.kind === "cleared" && params.pagePaths?.length) {
          const requiredClient = client ?? (await requireObsidianClient(root));
          await markPageStatus(
            root,
            params.pagePaths,
            "cleared",
            {
              cleared_at: new Date().toISOString(),
            },
            requiredClient,
          );
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

  pi.registerTool({
    name: "wiki_sync",
    label: "Wiki Sync",
    description:
      "Seed Wiki topic pages from PARA vault structure. Run once during setup, then again only when new PARA folders are added.",
    promptSnippet:
      "Bootstrap wiki topics from PARA folders (Area/, Resource/, Project/)",
    promptGuidelines: [
      "Use this tool to seed Wiki topics from your PARA vault structure during initial setup.",
      "Run with scope='all' when new PARA folders are added after setup.",
      "After initial sync, the agent builds Wiki organically from discussions and sources.",
      "Existing topic synthesis content is preserved.",
    ],
    parameters: Type.Object({
      scope: StringEnum(["area", "resource", "projects", "all"] as const),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const config = await loadConfig(root);
      const client = await requireObsidianClient(root);
      return withRootLock(root, async () => {
        const registry = await loadRegistry(root);
        const result = await syncParaToWiki(
          root,
          config,
          registry,
          params.scope,
          client,
        );

        await appendEvent(
          root,
          {
            ts: new Date().toISOString(),
            kind: "refactor",
            title: `Synced ${params.scope} PARA folders to wiki`,
            actor: "extension",
            notes: [
              `created=${result.topicsCreated}`,
              `updated=${result.topicsUpdated}`,
            ],
          },
          client,
        );

        await rebuildAllGeneratedArtifacts(root);

        return {
          content: [
            {
              type: "text",
              text: `Synced ${params.scope}: ${result.topicsCreated} created, ${result.topicsUpdated} updated`,
            },
          ],
          details: result,
        };
      });
    },
  });

  pi.registerTool({
    name: "wiki_triage",
    label: "Wiki Triage",
    description:
      "Manage LIST.md as shared routing center between human and agent.",
    promptSnippet:
      "Read, add, suggest, or flag stale items in the vault's LIST.md",
    promptGuidelines: [
      "Use this tool to participate in the human's task inbox.",
      "All AI content must use the '> 🤖 [AI]' prefix.",
      "Never mark items complete or delete items.",
      "Treat LIST.md as an intake queue, not a substitute for graph discovery.",
    ],
    parameters: Type.Object({
      action: StringEnum(["read", "add", "suggest", "flag_stale"] as const),
      content: Type.Optional(
        Type.String({ description: "Content for add action" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const client = await requireObsidianClient(root);
      const result = await triageList(
        root,
        params.action,
        params.content,
        client,
      );

      return {
        content: [
          {
            type: "text",
            text: formatTriageResult(params.action, result),
          },
        ],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "wiki_project_sync",
    label: "Wiki Project Sync",
    description:
      "Sync with Project/ folders — scan, review, add notes, suggest tasks.",
    promptSnippet:
      "Read project status, run the weekly project review for Project/PROJECTS.md, add research notes, or suggest tasks in LIST.md",
    promptGuidelines: [
      "Use this tool to participate in project workflows.",
      "Use vault search and graph discovery before creating project notes or task suggestions.",
      "Organize for retrieval: expose type, time, topic, and status through project metadata.",
      "scan returns projects with status, priority, deadline, and next_action metadata.",
      "review answers the future-mode weekly control questions: what is active, waiting, complete, archivable, or missing a next action.",
      "create_project creates Project/wNN-Title/wNN-Title.md using the current ISO week.",
      "create_project seeds type, status, date, project, priority, deadline, and next_action frontmatter.",
      "add_note appends research to project/notes.md.",
      "suggest_task adds to LIST.md with AI indicator.",
    ],
    parameters: Type.Object({
      action: StringEnum([
        "scan",
        "create_project",
        "add_note",
        "suggest_task",
        "review",
        "set_status",
        "set_next_action",
        "set_deadline",
        "link_resource",
        "relate",
        "timeline_append",
        "task_add",
        "task_update",
        "task_close",
        "task_block",
        "task_promote",
      ] as const),
      project: Type.Optional(
        Type.String({ description: "Project title or folder name" }),
      ),
      content: Type.Optional(
        Type.String({ description: "Note content or task suggestion" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const client = await requireObsidianClient(root);
      const result = await syncProject(
        root,
        params.action,
        params.project,
        params.content,
        client,
      );

      return {
        content: [
          {
            type: "text",
            text: formatProjectSyncResult(params.action, result),
          },
        ],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "wiki_task",
    label: "Wiki Task",
    description:
      "Create, annotate, or complete Taskwarrior tasks with validation. Extension enforces rules; agent uses direct CLI for safe reads.",
    promptSnippet:
      "Promote LIST.md items into validated Taskwarrior tasks, annotate existing tasks, or mark tasks complete",
    promptGuidelines: [
      "Use graph and vault search first when the task is derived from a source or wiki topic.",
      "Use promote action when creating new tasks from LIST.md or scan proposals.",
      "Use annotate action to add wiki links or context notes to existing tasks.",
      "Use done action to mark a task complete.",
    ],
    parameters: Type.Object({
      action: StringEnum(["promote", "annotate", "done"] as const),
      description: Type.Optional(Type.String()),
      project: Type.Optional(Type.String()),
      scheduled: Type.Optional(Type.String()),
      priority: Type.Optional(StringEnum(["IU", "I", "U"] as const)),
      estimate: Type.Optional(Type.Number()),
      tags: Type.Optional(Type.Array(Type.String())),
      due: Type.Optional(Type.String()),
      recur: Type.Optional(Type.String()),
      dependsOn: Type.Optional(Type.Array(Type.String())),
      wikiLinks: Type.Optional(Type.Array(Type.String())),
      source: Type.Optional(
        Type.String({
          description: "Source reference, e.g. LIST.md:2026-06-01:item-3",
        }),
      ),
      dryRun: Type.Optional(Type.Boolean({ default: false })),
      taskId: Type.Optional(Type.Number()),
      text: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const root = await resolveWikiRoot(_ctx.cwd);
      const client = await getObsidianClient(root);
      return handleWikiTaskAction(pi, params, root, client) as any;
    },
  });

  pi.registerTool({
    name: "wiki_task_scan",
    label: "Wiki Task Scan",
    description:
      "Analyze vault state and propose Taskwarrior tasks automatically.",
    promptSnippet:
      "Scan LIST.md, projects, and wiki meta for items that could become Taskwarrior tasks",
    parameters: Type.Object({
      scope: Type.Optional(
        StringEnum(["list_md", "projects", "wiki_meta", "all"] as const),
      ),
      since: Type.Optional(
        Type.String({
          description: "ISO date for staleness threshold (default: 7 days ago)",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const client = await getObsidianClient(root);
      const runner = {
        exec: (command: string, args?: string[], options?: unknown) =>
          pi.exec(command, args, options),
      };
      const syncResult = await syncCompletedTasksToList(root, runner, client);
      const registry = await loadRegistry(root);
      const proposals = await scanVaultForTasks(root, registry, {
        scope: params.scope ?? "all",
        since: params.since,
      });
      return {
        content: [
          { type: "text", text: formatScanResult(proposals, syncResult) },
        ],
        details: { proposals, syncResult },
      };
    },
  });

  pi.registerTool({
    name: "wiki_week",
    label: "Wiki Week",
    description: "Regenerate WEEK.md from current Taskwarrior state.",
    promptSnippet: "Refresh the weekly task dashboard from Taskwarrior queries",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const vaultRoot = resolve(root, "..");
      const client = await getObsidianClient(root);
      const runner = {
        exec: (command: string, args?: string[], options?: unknown) =>
          pi.exec(command, args, options),
      };
      const syncResult = await syncCompletedTasksToList(root, runner, client);
      const records = await taskExport(
        runner,
        "status:pending or status:completed",
      );
      const md = renderWeekMd(records);
      const path = await writeWeekMd(vaultRoot, md);
      return {
        content: [
          {
            type: "text",
            text: `WEEK.md refreshed at ${path}${syncResult.markedDone > 0 ? ` (${syncResult.markedDone} LIST.md items synced)` : ""}`,
          },
        ],
        details: { path, text: md, syncResult },
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
      const client = await requireObsidianClient(root);
      const mode = (args?.trim() || "all") as Parameters<typeof runLint>[1];
      const result = await runLint(root, mode, true, 50, client);
      ctx.ui.notify(
        formatLint(result, ctx.cwd, root),
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

      const client = await requireObsidianClient(root);

      return withRootLock(root, async () => {
        const ts = new Date().toISOString();
        await appendEvent(
          root,
          {
            ts,
            kind: "consumed",
            title: `Consumed ${pagePath}`,
            pagePaths: [pagePath],
            notes: pkbRefs.map((ref) => `pkb:${ref}`),
            actor: "user",
          },
          client,
        );
        await markPageStatus(
          root,
          [pagePath],
          "consumed",
          {
            consumed_at: ts,
            pkb_refs: pkbRefs,
          },
          client,
        );
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
  const client = await getObsidianClient(root);
  const { rebuilt, registry } = await rebuildRegistryAndIndex(root, client);
  const workflowRoutesPath = await rebuildWorkflowRoutes(root, registry);
  const logPath = await rebuildLog(root, config.title);
  const digestPath = await rebuildDigest(root, registry);
  return [...rebuilt, workflowRoutesPath, logPath, digestPath];
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

function adjustContextGatherArgs(
  command: string,
  args: string[],
  limitCommits: number | undefined,
): string[] {
  if (command !== "git" || limitCommits == null || args[0] !== "log" || !args[1]?.startsWith("-")) {
    return args;
  }

  const requestedLimit = Number(args[1].slice(1));
  if (!Number.isFinite(requestedLimit)) {
    return args;
  }

  return [args[0], `-${Math.min(requestedLimit, limitCommits)}`, ...args.slice(2)];
}

export async function buildStatus(root: string): Promise<StatusSummary> {
  const config = await loadConfig(root);
  const registry = await loadRegistry(root);
  const events = await readEvents(root);
  const captureStates = await listCaptureStates(root);
  const totals = {
    allPages: registry.pages.length,
    summary: registry.pages.filter((page) => page.type === "summary").length,
    topic: registry.pages.filter((page) => page.type === "topic").length,
    plan: registry.pages.filter((page) => page.type === "plan").length,
    review: registry.pages.filter((page) => page.type === "review").length,
    workflow: registry.pages.filter((page) => page.type === "workflow").length,
  };
  const sources = registry.pages.filter((page) => page.type === "summary");
  const captured = sources.filter((page) => page.status === "captured").length;
  const pendingIntegration = captureStates.filter(
    (state) => state.status === "integration_pending" || state.status === "integrating",
  ).length;
  const integrated = sources.filter(
    (page) => page.status === "integrated",
  ).length;
  const consumed = sources.filter((page) => page.status === "consumed").length;
  const archived = sources.filter((page) => page.status === "archived").length;
  const cleared = sources.filter((page) => page.status === "cleared").length;

  const integratedEntries = sources.filter(
    (page) => page.status === "integrated" && page.updated,
  );
  const oldestIntegrated =
    integratedEntries.length > 0
      ? integratedEntries.reduce(
          (oldest, entry) =>
            entry.updated! < oldest ? entry.updated! : oldest,
          integratedEntries[0].updated!,
        )
      : undefined;

  const pagesWithExternal = registry.pages.filter(
    (p) => p.externalBacklinks > 0,
  );
  const externalTotal = pagesWithExternal.reduce(
    (sum, p) => sum + p.externalBacklinks,
    0,
  );
  const topPage =
    pagesWithExternal.length > 0
      ? pagesWithExternal.reduce(
          (best, p) =>
            p.externalBacklinks > best.externalBacklinks ? p : best,
          pagesWithExternal[0],
        )
      : undefined;

  const externalBacklinks =
    externalTotal > 0
      ? {
          total: externalTotal,
          pageCount: pagesWithExternal.length,
          topPage: topPage
            ? { title: topPage.title, count: topPage.externalBacklinks }
            : undefined,
        }
      : undefined;

  return {
    totals,
    sources: {
      captured,
      pendingIntegration,
      integrated,
      unintegrated: captured + pendingIntegration,
      consumed,
      archived,
      cleared,
    },
    lastCapture: [...events].reverse().find((event) => event.kind === "capture")
      ?.ts,
    lastEvent: events.at(-1)?.ts,
    oldestIntegrated,
    externalBacklinks,
    externalContexts: listConfiguredContexts(config.contexts),
  };
}

/**
 * Convert a wiki-relative path (e.g. pages/topics/foo.md) to a vault-relative
 * path (e.g. Wiki/pages/topics/foo.md) so the agent can resolve it from cwd.
 */
function vaultRelative(
  cwd: string,
  wikiRoot: string,
  wikiPath: string,
): string {
  const prefix = relative(cwd, wikiRoot);
  if (prefix === "" || prefix === ".") return wikiPath;
  return `${prefix}/${wikiPath}`;
}

function formatSearch(
  result: Awaited<ReturnType<typeof searchRegistry>>,
  cwd: string,
  wikiRoot: string,
): string {
  if (result.matches.length === 0)
    return `No wiki matches for: ${result.query}`;
  return [
    `Top matches for: ${result.query}`,
    ...result.matches.map(
      (match) =>
        `- [${match.score}] ${match.title} (${match.type}) — ${vaultRelative(cwd, wikiRoot, match.path)}`,
    ),
  ].join("\n");
}

function formatEnsurePage(
  result: {
    resolved: boolean;
    created: boolean;
    conflict: boolean;
    path?: string;
    title?: string;
    candidates?: Array<{ path: string; title: string }>;
  },
  cwd: string,
  wikiRoot: string,
): string {
  const vp = (p: string) => vaultRelative(cwd, wikiRoot, p);
  if (result.conflict) {
    return `Conflict: multiple pages matched. Candidates: ${(result.candidates ?? []).map((candidate) => vp(candidate.path)).join(", ")}`;
  }
  if (!result.resolved) return "No matching page found.";
  if (result.created) return `Created page: ${vp(result.path!)}`;
  return `Resolved existing page: ${vp(result.path!)}`;
}

function formatWorkflowResult(
  result: WorkflowResult,
  cwd: string,
  wikiRoot: string,
): string {
  const vp = (p: string) => vaultRelative(cwd, wikiRoot, p);
  if (result.conflict) {
    return `Workflow conflict: existing workflow matched. Candidates: ${(result.candidates ?? []).map((candidate) => vp(candidate.path!)).join(", ")}`;
  }
  if (result.created) {
    return `Generated workflow: ${vp(result.path!)}`;
  }
  return "No workflow generated.";
}

function formatLint(
  result: Awaited<ReturnType<typeof runLint>>,
  cwd: string,
  wikiRoot: string,
): string {
  return [
    `Lint mode: ${result.mode}`,
    `Total issues: ${result.counts.total}`,
    `brokenLinks=${result.counts.brokenLinks} orphans=${result.counts.orphans} frontmatter=${result.counts.frontmatter}`,
    `duplicates=${result.counts.duplicates} coverage=${result.counts.coverage} staleness=${result.counts.staleness}`,
    ...(result.reportPath
      ? [`Report: ${vaultRelative(cwd, wikiRoot, result.reportPath)}`]
      : []),
  ].join("\n");
}

function formatStatus(status: StatusSummary): string {
  return [
    `Pages: ${status.totals.allPages} total (${status.totals.summary} summary, ${status.totals.topic} topic, ${status.totals.plan} plan, ${status.totals.review} review, ${status.totals.workflow} workflow)`,
    `Sources: ${status.sources.captured} captured, ${status.sources.pendingIntegration} pending integration, ${status.sources.integrated} integrated, ${status.sources.consumed} consumed, ${status.sources.archived} archived, ${status.sources.cleared} cleared`,
    ...(status.externalBacklinks
      ? [
          `Cross-vault backlinks: ${status.externalBacklinks.total} across ${status.externalBacklinks.pageCount} pages` +
            (status.externalBacklinks.topPage
              ? ` (top: ${status.externalBacklinks.topPage.title} — ${status.externalBacklinks.topPage.count} external)`
              : ""),
        ]
      : []),
    ...(status.oldestIntegrated
      ? [`Oldest unintegrated: ${status.oldestIntegrated}`]
      : []),
    ...(status.lastCapture ? [`Last capture: ${status.lastCapture}`] : []),
    ...(status.lastEvent ? [`Last event: ${status.lastEvent}`] : []),
    ...(status.externalContexts?.length
      ? ["", formatExternalContextCatalog(status.externalContexts)]
      : []),
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

    // LIST.md analysis
    const listMd = result.vaultActivity.listMdAnalysis;
    lines.push(`\nLIST.md:`);
    lines.push(`  Total items: ${listMd.items.length}`);
    lines.push(`  Unprocessed: ${listMd.unprocessedItems.length}`);

    // Category breakdown
    const catCounts: Record<string, number> = {};
    for (const item of listMd.unprocessedItems) {
      catCounts[item.category] = (catCounts[item.category] ?? 0) + 1;
    }
    const catStr = Object.entries(catCounts)
      .map(([cat, n]) => `${cat}: ${n}`)
      .join(", ");
    if (catStr) lines.push(`  By category: ${catStr}`);

    if (listMd.oldestUnprocessedDate) {
      lines.push(`  Oldest unprocessed: ${listMd.oldestUnprocessedDate}`);
    }

    if (listMd.unprocessedSourceUrls.length > 0) {
      lines.push(
        `  Un-captured source URLs: ${listMd.unprocessedSourceUrls.length}`,
      );
      for (const item of listMd.unprocessedSourceUrls.slice(0, 3)) {
        lines.push(
          `    - ${item.text.slice(0, 80)}${item.text.length > 80 ? "..." : ""}`,
        );
      }
    }
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
      lines.push(
        `  Awaiting Recall: ${result.lifecycle.integratedAwaitingRecall.length} entries`,
      );
      for (const entry of result.lifecycle.integratedAwaitingRecall.slice(
        0,
        5,
      )) {
        lines.push(
          `    - ${entry.title} (${entry.daysSinceIntegration}d since integration)`,
        );
      }
    } else {
      lines.push(`  Awaiting Recall: none`);
    }
    if (result.lifecycle.consumedReactivated.length > 0) {
      lines.push(
        `  Reactivated (consumed with new sources): ${result.lifecycle.consumedReactivated.length} entries`,
      );
    }
    if (result.lifecycle.clearableCandidates.length > 0) {
      lines.push(
        `  Clearable: ${result.lifecycle.clearableCandidates.length} archived entries`,
      );
    } else {
      lines.push(`  Clearable: none`);
    }
  }

  return lines.join("\n");
}

function formatTriageResult(action: string, result: TriageResult): string {
  if (action === "read" && result.analysis) {
    return [
      `LIST.md Analysis:`,
      `Total items: ${result.analysis.totalItems}`,
      `Unchecked: ${result.analysis.uncheckedItems}`,
      `Stale (>7d): ${result.analysis.staleItems}`,
      `Recent (≤3d): ${result.analysis.recentItems}`,
    ].join("\n");
  }
  if (action === "add" && result.added) {
    return "Added to LIST.md with AI indicator.";
  }
  if (result.suggestions) {
    return result.suggestions.join("\n");
  }
  return "Done.";
}

function formatProjectSyncResult(
  action: string,
  result: ProjectSyncResult,
): string {
  if (action === "scan" && result.projects) {
    if (result.projects.length === 0) return "No projects found.";
    return [
      `Projects (${result.projects.length}):`,
      ...result.projects.map(
        (p) =>
          `- ${p.title} [${p.status}] ${p.priority}${p.deadline ? ` (due: ${p.deadline})` : ""}${p.nextAction ? ` — next: ${p.nextAction}` : ""}`,
      ),
    ].join("\n");
  }
  if (action === "review" && result.review) {
    const review = result.review;
    const lines = [
      `Project review: idea=${review.counts.idea} active=${review.counts.active} waiting=${review.counts.waiting} blocked=${review.counts.blocked} done=${review.counts.done} archived=${review.counts.archived} unknown=${review.counts.unknown}`,
      `Blocked: ${review.blocked?.length ?? 0}`,
      ...(review.blocked ?? [])
        .slice(0, 5)
        .map((p) => `- ${p.title} [${p.status}]`),
      `Missing next action: ${review.noNextAction.length}`,
      ...review.noNextAction
        .slice(0, 5)
        .map((p) => `- ${p.title} [${p.status}]`),
      `Archive candidates: ${review.archiveCandidates.length}`,
      ...review.archiveCandidates
        .slice(0, 5)
        .map((p) => `- ${p.title} [${p.status}]`),
    ];
    return lines.join("\n");
  }
  if (action === "add_note" && result.noteAdded) {
    return "Research note added to project.";
  }
  if (action === "create_project" && result.projectCreated) {
    return `Project created: ${result.projectPath}`;
  }
  if ((action === "set_status" || action === "set_next_action" || action === "set_deadline" || action === "link_resource" || action === "relate" || action === "timeline_append") && result.projectUpdated) {
    return "Project updated.";
  }
  if ((action === "task_add" || action === "task_update" || action === "task_close" || action === "task_block") && result.taskUpdated) {
    return "Project task updated.";
  }
  if (action === "suggest_task" && result.taskSuggested) {
    return "Task suggestion added to LIST.md.";
  }
  if (action === "task_promote" && result.taskSuggested) {
    return "Project task promoted to LIST.md.";
  }
  return "Done.";
}

function buildTaskAddArgs(payload: {
  description: string;
  project: string;
  scheduled: string;
  priority: "H" | "M" | "L";
  estimate: number;
  tags: string[];
  due?: string;
  recur?: string;
}): string[] {
  const args: string[] = [
    payload.description,
    `project:${payload.project}`,
    `scheduled:${payload.scheduled}`,
    `priority:${payload.priority}`,
    `estimate:${payload.estimate}`,
    ...payload.tags.map((t) => `+${t}`),
  ];
  if (payload.due) args.push(`due:${payload.due}`);
  if (payload.recur) args.push(`recur:${payload.recur}`);
  return args;
}

function formatScanResult(
  proposals: ScanProposal[],
  syncResult?: { markedDone: number; errors: string[] },
): string {
  const parts: string[] = [];
  if (syncResult && syncResult.markedDone > 0) {
    parts.push(`Synced ${syncResult.markedDone} completed task(s) to LIST.md.`);
  }
  if (syncResult && syncResult.errors.length > 0) {
    parts.push(`Sync errors: ${syncResult.errors.join("; ")}`);
  }
  if (proposals.length === 0) {
    parts.push("No task proposals found.");
    return parts.join("\n");
  }
  parts.push(`Found ${proposals.length} proposals:`);
  const lines = proposals.map(
    (p, i) =>
      `${i + 1}. ${p.description}\n   project: ${p.project} | estimate: ${p.estimate} | priority: ${p.priority} | scheduled: ${p.scheduled}\n   reason: ${p.reason} | source: ${p.source}`,
  );
  parts.push(lines.join("\n\n"));
  return parts.join("\n\n");
}

async function handleWikiTaskAction(
  pi: ExtensionAPI,
  params: Record<string, unknown>,
  _root: string,
  client: ObsidianClient | null,
) {
  const runner = {
    exec: (command: string, args?: string[], options?: unknown) =>
      pi.exec(command, args, options),
  };

  if (params.action === "promote") {
    if (
      !params.description ||
      !params.project ||
      !params.scheduled ||
      !params.priority ||
      params.estimate == null ||
      !params.tags
    ) {
      return {
        content: [
          { type: "text", text: "Missing required fields for promote action." },
        ],
        details: {
          success: false,
          errors: [
            "Description, project, scheduled, priority, estimate, and tags are required.",
          ],
        },
      };
    }

    const payload = {
      description: String(params.description),
      project: String(params.project),
      scheduled: String(params.scheduled),
      priority: priorityMap[String(params.priority)]!,
      estimate: Number(params.estimate),
      tags: params.tags as string[],
      due: params.due ? String(params.due) : undefined,
      recur: params.recur ? String(params.recur) : undefined,
      dependsOn: params.dependsOn as string[] | undefined,
    };

    const validation = validatePromotion(payload);
    if (!validation.valid) {
      return {
        content: [
          {
            type: "text",
            text: `Validation failed:\n${validation.errors.map((e) => `- ${e.field}: ${e.message}`).join("\n")}`,
          },
        ],
        details: { success: false, validationResult: validation },
      };
    }

    if (params.dryRun) {
      const cmd = "task add " + buildTaskAddArgs(payload).join(" ");
      return {
        content: [{ type: "text", text: `Dry-run command:\n${cmd}` }],
        details: { success: true, dryRun: true, command: cmd },
      };
    }

    // Create task
    const addArgs = buildTaskAddArgs(payload);
    const addResult = await taskExec(runner, ["add", ...addArgs]);
    if (!addResult.success) {
      return {
        content: [
          {
            type: "text",
            text: `Task add failed: ${addResult.errors?.join(", ") ?? addResult.stderr}`,
          },
        ],
        details: { success: false, errors: addResult.errors },
      };
    }

    // Find the newly created task by filtering for matching description + project
    const exportResult = await taskExport(
      runner,
      `status:pending project:${payload.project}`,
    );
    const newTask = exportResult.find(
      (t) => t.description === payload.description,
    );
    const taskId = newTask?.id;

    // Add dependencies
    if (taskId && payload.dependsOn?.length) {
      for (const depUuid of payload.dependsOn) {
        await taskExec(runner, [
          String(taskId),
          "modify",
          `depends:${depUuid}`,
        ]);
      }
    }

    // Annotate wiki links
    if (taskId && params.wikiLinks) {
      const links = params.wikiLinks as string[];
      for (const link of links) {
        await taskExec(runner, [
          String(taskId),
          "annotate",
          `Wiki: [[${link}]]`,
        ]);
      }
    }

    // Annotate source reference and mark LIST.md as promoted
    if (taskId && params.source) {
      const source = String(params.source);
      await taskExec(runner, [String(taskId), "annotate", `source: ${source}`]);
      const match = source.match(/^LIST\.md:(\d{4}-\d{2}-\d{2}):item-(\d+)$/);
      if (match) {
        const [, date, itemIndexStr] = match;
        await markListItemPromoted(
          _root,
          date,
          parseInt(itemIndexStr, 10),
          client,
        );
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Created task ${taskId ?? "?"}: ${payload.description}`,
        },
      ],
      details: { success: true, taskId },
    };
  }

  if (params.action === "annotate") {
    if (!params.taskId || !params.text) {
      return {
        content: [
          {
            type: "text",
            text: "TaskId and text are required for annotate action.",
          },
        ],
        details: { success: false, errors: ["TaskId and text are required."] },
      };
    }
    const result = await taskExec(runner, [
      String(params.taskId),
      "annotate",
      String(params.text),
    ]);
    return {
      content: [
        {
          type: "text",
          text: result.success
            ? `Annotated task ${params.taskId}`
            : `Failed: ${result.errors?.join(", ")}`,
        },
      ],
      details: { success: result.success },
    };
  }

  if (params.action === "done") {
    if (!params.taskId) {
      return {
        content: [
          { type: "text", text: "TaskId is required for done action." },
        ],
        details: { success: false, errors: ["TaskId is required."] },
      };
    }
    const result = await taskExec(runner, [String(params.taskId), "done"]);
    return {
      content: [
        {
          type: "text",
          text: result.success
            ? `Completed task ${params.taskId}`
            : `Failed: ${result.errors?.join(", ")}`,
        },
      ],
      details: { success: result.success },
    };
  }

  return {
    content: [{ type: "text", text: "Unknown action." }],
    details: { success: false },
  };
}
