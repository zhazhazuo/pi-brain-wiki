import { stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { arrayOfStrings, buildBacklinks, buildRegistry, scanWikiPages } from "./indexer.ts";
import { GRACE_PERIODS } from "./lifecycle.ts";
import { metaPath, normalizeWikiLinkTarget, vaultRoot } from "./paths.ts";
import type { BacklinksData, LintIssue, LintRun, ParsedPage, RegistryData } from "./types.ts";
import type { ObsidianClient } from "./obsidian-client.ts";

const SUMMARY_REQUIRED = [
  "id",
  "type",
  "title",
  "status",
  "captured_at",
  "origin_type",
  "origin_value",
  "manifest_path",
  "raw_path",
  "source_ids",
  "summary",
] as const;

const TOPIC_REQUIRED = ["id", "type", "title", "status", "updated", "source_ids", "summary"] as const;

const PLAN_REQUIRED = ["id", "type", "title", "status", "date", "updated"] as const;

const REVIEW_REQUIRED = ["id", "type", "title", "status", "period", "updated"] as const;

const WORKFLOW_REQUIRED = ["id", "type", "title", "status", "updated", "version", "triggers", "summary"] as const;

const FRONTMATTER_REQUIRED: Record<string, readonly string[]> = {
  summary: SUMMARY_REQUIRED,
  topic: TOPIC_REQUIRED,
  plan: PLAN_REQUIRED,
  review: REVIEW_REQUIRED,
  workflow: WORKFLOW_REQUIRED,
};

const VALID_STATUS: Record<string, readonly string[]> = {
  summary: ["captured", "integrated", "consumed", "archived", "cleared"],
  topic: ["draft", "integrated", "consumed", "archived", "cleared"],
  plan: ["active", "completed", "archived"],
  review: ["active", "completed", "archived"],
  workflow: ["draft", "active", "archived"],
};

function hasOwn(frontmatter: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(frontmatter, key);
}

function isArchivedOrCleared(page: ParsedPage | RegistryData["pages"][number]): boolean {
  const status = ("frontmatter" in page ? page.frontmatter.status : page.status) ?? "";
  return status === "archived" || status === "cleared";
}

export async function runLint(
  root: string,
  mode: string,
  writeReport = false,
  limit?: number,
  client?: ObsidianClient | null
): Promise<LintRun> {
  const pages = await scanWikiPages(root);
  const registry = buildRegistry(pages);
  const backlinks = buildBacklinks(registry);

  const allIssues: LintIssue[] = [];

  if (mode === "links" || mode === "all") {
    allIssues.push(...lintInboxLinks(pages));
    if (client) {
      allIssues.push(...await lintLinksViaCLI(root, client));
    } else {
      allIssues.push(...lintLinks(pages, registry));
    }
  }

  if (mode === "orphans" || mode === "all") {
    if (client) {
      allIssues.push(...await lintOrphansViaCLI(root, client));
    } else {
      allIssues.push(...lintOrphans(registry, backlinks));
    }
  }

  if (mode === "frontmatter" || mode === "all") allIssues.push(...lintFrontmatter(pages));
  if (mode === "duplicates" || mode === "all") allIssues.push(...lintDuplicates(registry));
  if (mode === "coverage" || mode === "all") allIssues.push(...lintCoverage(registry, backlinks));
  if (mode === "staleness" || mode === "all") allIssues.push(...lintStaleness(registry));
  if (mode === "staleness" || mode === "all") allIssues.push(...lintStaleConsumed(registry, backlinks));
  if (mode === "staleness" || mode === "all") allIssues.push(...await lintStaleSync(root, registry));

  const issues = typeof limit === "number" ? allIssues.slice(0, limit) : allIssues;
  const run: LintRun = {
    mode,
    counts: {
      total: allIssues.length,
      brokenLinks: allIssues.filter((issue) => issue.kind === "broken-link").length,
      orphans: allIssues.filter((issue) => issue.kind === "orphan").length,
      frontmatter: allIssues.filter((issue) => issue.kind === "frontmatter").length,
      duplicates: allIssues.filter((issue) => issue.kind === "duplicate").length,
      coverage: allIssues.filter((issue) => issue.kind === "coverage").length,
      staleness: allIssues.filter((issue) => issue.kind === "staleness").length,
    },
    issues,
  };

  if (writeReport) {
    const reportPath = metaPath(root, "lint-report.md");
    await writeFile(reportPath, renderLintReport(run), "utf8");
    run.reportPath = "meta/lint-report.md";
  }

  return run;
}

export function renderLintReport(run: LintRun): string {
  const lines: string[] = [
    "# Lint Report",
    "",
    `Mode: ${run.mode}`,
    `Total issues: ${run.counts.total}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Counts",
    "",
    `- brokenLinks: ${run.counts.brokenLinks}`,
    `- orphans: ${run.counts.orphans}`,
    `- frontmatter: ${run.counts.frontmatter}`,
    `- duplicates: ${run.counts.duplicates}`,
    `- coverage: ${run.counts.coverage}`,
    `- staleness: ${run.counts.staleness}`,
    "",
    "## Issues",
    "",
  ];

  if (run.issues.length === 0) {
    lines.push("_No issues found._");
  } else {
    for (const issue of run.issues) {
      lines.push(`- **${issue.severity}** [${issue.kind}] \`${issue.path}\` — ${issue.message}`);
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function lintInboxLinks(pages: ParsedPage[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const reported = new Set<string>();

  for (const page of pages) {
    if (isArchivedOrCleared(page)) continue;
    for (const rawLink of page.rawLinks) {
      if (!rawLink.startsWith("inbox/")) continue;
      const key = `${page.relativePath}::${rawLink}`;
      if (reported.has(key)) continue;
      reported.add(key);
      issues.push({
        kind: "broken-link",
        severity: "error",
        path: page.relativePath,
        message: `Wiki pages must not link to inbox packets directly: [[${rawLink}]]`,
      });
    }
  }

  return issues;
}

function lintLinks(pages: ParsedPage[], registry: RegistryData): LintIssue[] {
  const known = new Set(registry.pages.filter((p) => !isArchivedOrCleared(p)).map((page) => page.path));
  const issues: LintIssue[] = [];

  for (const page of pages) {
    if (isArchivedOrCleared(page)) continue;
    for (const rawLink of page.rawLinks) {
      // Skip PARA links — they point outside the wiki
      if (
        rawLink.startsWith("Resource/") ||
        rawLink.startsWith("Project/") ||
        rawLink.startsWith("Area/") ||
        rawLink.startsWith("Archive/") ||
        rawLink.startsWith("Draft/")
      ) {
        continue;
      }

      // Skip inbox links — lintInboxLinks() owns this prohibition
      if (rawLink.startsWith("inbox/")) continue;

      const normalized = normalizeWikiLinkTarget(rawLink);
      if (!normalized) {
        issues.push({
          kind: "broken-link",
          severity: "warning",
          path: page.relativePath,
          message: `Link is not folder-qualified or cannot be normalized: [[${rawLink}]]`,
        });
        continue;
      }
      if (!known.has(normalized)) {
        issues.push({
          kind: "broken-link",
          severity: "error",
          path: page.relativePath,
          message: `Target does not exist: [[${rawLink}]]`,
        });
      }
    }
  }

  return issues;
}

function lintOrphans(registry: RegistryData, backlinks: BacklinksData): LintIssue[] {
  // Only flag topics as orphans (plans and reviews are time-bound, not expected to be linked)
  return registry.pages
    .filter((page) => page.type === "topic" && !isArchivedOrCleared(page))
    .flatMap((page) => {
      const record = backlinks.byPath[page.path];
      if (!record) return [];
      if (record.inbound.length === 0 && record.outbound.length === 0) {
        return [
          {
            kind: "orphan",
            severity: "warning",
            path: page.path,
            message: "Canonical page has no inbound or outbound wiki links.",
          } satisfies LintIssue,
        ];
      }
      return [];
    });
}

function lintFrontmatter(pages: ParsedPage[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const summaryIds = new Set(
    pages
      .filter((entry) => String(entry.frontmatter.type) === "summary")
      .map((entry) => String(entry.frontmatter.id || ""))
      .filter(Boolean)
  );

  for (const page of pages) {
    if (isArchivedOrCleared(page)) continue;
    const pageType = String(page.frontmatter.type || "");
    const required = FRONTMATTER_REQUIRED[pageType];
    if (!required) {
      issues.push({
        kind: "frontmatter",
        severity: "warning",
        path: page.relativePath,
        message: `Unknown page type: ${pageType}`,
      });
      continue;
    }
    for (const field of required) {
      if (!hasOwn(page.frontmatter, field)) {
        issues.push({
          kind: "frontmatter",
          severity: "error",
          path: page.relativePath,
          message: `Missing required frontmatter field: ${field}`,
        });
      }
    }

    if (hasOwn(page.frontmatter, "status")) {
      const status = String(page.frontmatter.status || "");
      const validStatuses = VALID_STATUS[pageType];
      if (!validStatuses?.includes(status)) {
        issues.push({
          kind: "frontmatter",
          severity: "error",
          path: page.relativePath,
          message: `Invalid status "${status}" for page type: ${pageType}`,
        });
      }
    }

    if (pageType === "summary" && hasOwn(page.frontmatter, "source_ids")) {
      const sourceIds = arrayOfStrings(page.frontmatter.source_ids);
      if (sourceIds.length === 0) {
        issues.push({
          kind: "frontmatter",
          severity: "error",
          path: page.relativePath,
          message: "summary.source_ids must be non-empty",
        });
      }
    }

    if (pageType === "topic") {
      for (const sourceId of [...new Set(arrayOfStrings(page.frontmatter.source_ids))]) {
        if (!summaryIds.has(sourceId)) {
          issues.push({
            kind: "frontmatter",
            severity: "error",
            path: page.relativePath,
            message: "topic.source_ids must resolve to existing summary pages",
          });
        }
      }
    }

    const integratedAt = page.frontmatter.integrated_at;
    const integratedAtStr = integratedAt instanceof Date ? integratedAt.toISOString() : integratedAt;
    if (
      pageType === "summary" &&
      String(page.frontmatter.status) === "integrated" &&
      (!hasOwn(page.frontmatter, "integrated_at") || typeof integratedAtStr !== "string" || integratedAtStr.trim() === "")
    ) {
      issues.push({
        kind: "frontmatter",
        severity: "error",
        path: page.relativePath,
        message: "integrated summary pages must set integrated_at",
      });
    }

    // Validate consumed pages have consumed_at and pkb_refs
    if (String(page.frontmatter.status) === "consumed") {
      if (!hasOwn(page.frontmatter, "consumed_at")) {
        issues.push({
          kind: "frontmatter",
          severity: "error",
          path: page.relativePath,
          message: "Consumed page is missing consumed_at field.",
        });
      }
      if (!hasOwn(page.frontmatter, "pkb_refs") || !Array.isArray(page.frontmatter.pkb_refs) || page.frontmatter.pkb_refs.length === 0) {
        issues.push({
          kind: "frontmatter",
          severity: "error",
          path: page.relativePath,
          message: "Consumed page is missing pkb_refs field or it is empty.",
        });
      }
    }
  }
  return issues;
}

function lintDuplicates(registry: RegistryData): LintIssue[] {
  const issues: LintIssue[] = [];
  const seenTitles = new Map<string, string>();
  const seenAliases = new Map<string, string>();
  const seenIds = new Map<string, string>();

  // Only check topics for duplicates (summaries are date-stamped, plans/reviews are time-bound)
  for (const page of registry.pages.filter((entry) => entry.type === "topic" && !isArchivedOrCleared(entry))) {
    const normalizedTitle = page.title.trim().toLowerCase();
    if (seenTitles.has(normalizedTitle)) {
      issues.push({
        kind: "duplicate",
        severity: "warning",
        path: page.path,
        message: `Duplicate title also used by ${seenTitles.get(normalizedTitle)}`,
      });
    } else {
      seenTitles.set(normalizedTitle, page.path);
    }

    if (seenIds.has(page.id)) {
      issues.push({
        kind: "duplicate",
        severity: "error",
        path: page.path,
        message: `Duplicate id also used by ${seenIds.get(page.id)}`,
      });
    } else {
      seenIds.set(page.id, page.path);
    }

    for (const alias of page.aliases) {
      const normalizedAlias = alias.trim().toLowerCase();
      if (!normalizedAlias) continue;
      if (seenAliases.has(normalizedAlias)) {
        issues.push({
          kind: "duplicate",
          severity: "warning",
          path: page.path,
          message: `Duplicate alias "${alias}" also used by ${seenAliases.get(normalizedAlias)}`,
        });
      } else {
        seenAliases.set(normalizedAlias, page.path);
      }
    }
  }

  return issues;
}

function lintCoverage(registry: RegistryData, backlinks: BacklinksData): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const page of registry.pages) {
    if (isArchivedOrCleared(page)) continue;
    if (page.type === "summary") {
      const inbound = backlinks.byPath[page.path]?.inbound ?? [];
      const citedByTopic = inbound.filter((path) => !path.includes("/summaries/") && path !== page.path);
      if (citedByTopic.length === 0) {
        issues.push({
          kind: "coverage",
          severity: "info",
          path: page.path,
          message: "Summary page is not cited by any topic page yet.",
        });
      }
      continue;
    }

    if (page.sourceIds.length === 0 && page.type !== "plan" && page.type !== "review" && page.type !== "workflow") {
      issues.push({
        kind: "coverage",
        severity: "warning",
        path: page.path,
        message: "Topic page has no source_ids listed.",
      });
    }
  }
  return issues;
}

function lintStaleness(registry: RegistryData): LintIssue[] {
  return registry.pages.flatMap((page) => {
    if (isArchivedOrCleared(page)) return [];
    if (page.type === "summary") {
      if (page.status === "captured") {
        return [
          {
            kind: "staleness",
            severity: "info",
            path: page.path,
            message: "Summary page is still in captured state and has not been marked integrated.",
          } satisfies LintIssue,
        ];
      }
      return [];
    }

    if (page.type === "topic" && page.status === "draft") {
      // Flag topics in draft > grace period
      if (page.updated) {
        const updated = new Date(page.updated).getTime();
        const now = Date.now();
        const days = (now - updated) / 86_400_000;
        if (days > GRACE_PERIODS.draft_stale) {
          return [
            {
              kind: "staleness",
              severity: "warning",
              path: page.path,
              message: `Topic page has been in draft status for ${Math.floor(days)} days.`,
            } satisfies LintIssue,
          ];
        }
      }
    }

    return [];
  });
}

function lintStaleConsumed(registry: RegistryData, backlinks: BacklinksData): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const page of registry.pages) {
    if (page.status !== "consumed") continue;
    const record = backlinks.byPath[page.path];
    if (!record) continue;
    const inboundIntegrated = record.inbound.filter((inPath) => {
      const inboundPage = registry.pages.find((p) => p.path === inPath);
      return inboundPage && inboundPage.status === "integrated";
    });
    if (inboundIntegrated.length > 0) {
      issues.push({
        kind: "staleness",
        severity: "warning",
        path: page.path,
        message: `Consumed page has ${inboundIntegrated.length} newly integrated source(s) pointing at it. Consider reactivation (flip to integrated).`,
      });
    }
  }
  return issues;
}

async function lintStaleSync(root: string, registry: RegistryData): Promise<LintIssue[]> {
  const issues: LintIssue[] = [];
  const vRoot = vaultRoot(root);

  for (const page of registry.pages) {
    if (page.type !== "topic") continue;
    if (!page.status || page.status === "archived" || page.status === "cleared") continue;

    const lastSynced = (page as any).last_synced;
    const paraSource = (page as any).para_source;
    if (!lastSynced || !paraSource) continue;

    const paraPath = resolve(vRoot, paraSource);
    try {
      const stats = await stat(paraPath);
      const lastSyncedMs = new Date(lastSynced).getTime();
      if (stats.mtimeMs > lastSyncedMs) {
        issues.push({
          kind: "staleness",
          severity: "warning",
          path: page.path,
          message: `${page.path} may be stale — ${paraSource} modified ${stats.mtime.toISOString().slice(0, 10)}`,
        });
      }
    } catch {
      // PARA folder may not exist; skip
    }
  }

  return issues;
}

// ── CLI-based lint helpers ─────────────────────────────────────

async function lintLinksViaCLI(root: string, client: ObsidianClient): Promise<LintIssue[]> {
  const issues: LintIssue[] = [];
  const unresolved = await client.unresolved({ format: "json", verbose: true });

  for (const entry of unresolved) {
    if (typeof entry === "object" && entry.link && entry.sources) {
      if (String(entry.link).startsWith("inbox/")) continue;
      for (const source of entry.sources) {
        issues.push({
          kind: "broken-link",
          severity: "error",
          path: source,
          message: `Unresolved link: ${entry.link}`,
        });
      }
    }
  }

  return issues;
}

async function lintOrphansViaCLI(root: string, client: ObsidianClient): Promise<LintIssue[]> {
  const issues: LintIssue[] = [];
  const orphans = await client.orphans();

  for (const orphan of orphans) {
    // Only report wiki pages
    if (orphan.startsWith("Wiki/")) {
      issues.push({
        kind: "orphan",
        severity: "warning",
        path: orphan,
        message: "No incoming links from any vault page",
      });
    }
  }

  return issues;
}
