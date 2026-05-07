import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createDefaultConfig, hasWikiConfig, writeDefaultConfig } from "./config.ts";
import { readTemplate, renderTemplate, writePage } from "./frontmatter.ts";
import { canonicalPagePath, metaPath, toRelative } from "./paths.ts";
import { dedupeSlug, makePageId, slugifyTitle, todayStamp } from "./slug.ts";
import type { EnsurePageParams, EnsurePageResult, RegistryData, WikiConfig } from "./types.ts";

// ── Templates ────────────────────────────────────────────────

export const DEFAULT_SUMMARY_TEMPLATE = `---
id: {{id}}
type: summary
title: {{title}}
kind: {{kind}}
status: captured
captured_at: {{captured_at}}
integrated_at:
consumed_at:
pkb_refs:
origin_type: {{origin_type}}
origin_value: {{origin_value}}
manifest_path: {{manifest_path}}
raw_path: {{raw_path}}
aliases: []
tags: []
source_ids:
  - {{id}}
summary:
---

# {{title}}

## Source at a glance

## Executive summary

## Main claims

## Important details and data points

## Entities and concepts mentioned

## Reliability / caveats

## Integration targets
- [[topics/...]] — what this source affects

## Open questions

## Related pages
`;

export const DEFAULT_TOPIC_TEMPLATE = `---
id: {{id}}
type: topic
title: {{title}}
aliases: []
tags: []
status: draft
updated: {{updated}}
source_ids: []
consumed_at:
pkb_refs:
summary:
---

# {{title}}

## Current understanding

## Connections
- [[topics/...]] — related topics
- [[Area/...]] — PKB entries with depth

## Open questions

## Related pages
`;

export const DEFAULT_PLAN_TEMPLATE = `---
id: {{id}}
type: plan
title: {{title}}
status: active
date: {{date}}
updated: {{updated}}
---

# {{title}}

## Date / Period

## Priorities

## Timeboxed blocks

## Dependencies

## Notes
`;

export const DEFAULT_REVIEW_TEMPLATE = `---
id: {{id}}
type: review
title: {{title}}
status: active
period: {{period}}
updated: {{updated}}
---

# {{title}}

## Period

## Activity clusters

## Neglected areas

## Emerging patterns

## Recommendations
`;

// ── Schema ───────────────────────────────────────────────────

export function defaultSchemaMarkdown(title: string, domain = "General"): string {
  return `# ${title} Wiki Schema

This wiki is maintained as a persistent LLM-authored knowledge base for **${domain}**.

## Layers

1. **inbox/** - immutable source capture packets
2. **pages/** - editable wiki pages (summaries, topics, plans, reviews)
3. **meta/** - generated registry, backlinks, index, logs, and reports
4. **schema** - this file and .wiki/config.json

## Non-negotiable rules

- Never directly edit inbox/** or meta/**.
- Never hand-maintain generated metadata under meta/**.
- Every source must become a summary page before it influences topics.
- Update existing pages before creating new ones.
- Use folder-qualified wikilinks such as [[topics/example-topic]].
- Cite factual claims with source page ID links such as [[summaries/YYYY-MM-DD-Title|SRC-YYYY-MM-DD-NNN]].
- Query mode is read-only by default.
- Use Open questions and Tensions / caveats whenever evidence is uncertain.

## Page Taxonomy

- pages/summaries/ = what one source says
- pages/topics/ = what the wiki knows about a subject
- pages/plans/ = timeboxed plans with priorities
- pages/reviews/ = attention analysis and activity review

## Summary-page standard

Every summary page should answer:
- What is this source?
- What are its main claims?
- What concrete details or data points matter?
- Which topics does it touch?
- How reliable or limited is it?
- Which topics should be updated because of it?

## Integration targets

Every summary page lists which topics it affects:
\`\`\`markdown
## Integration targets
- [[topics/functional-programming]] — adds historical context
- [[topics/lambda-calculus]] — confirms existing timeline
\`\`\`

## Knowledge lifecycle

Pages move through statuses:

\`\`\`
captured → integrated → consumed → archived → cleared
               ↑            │
               └────────────┘  (reactivation on new source)
\`\`\`

| Status | Meaning | Included in search? |
|--------|---------|---------------------|
| \`captured\` | Source ingested, not yet integrated | Yes |
| \`integrated\` | Content woven into topics | Yes |
| \`consumed\` | Walker internalized; PKB is source of truth | Yes (follows pkb_refs) |
| \`archived\` | Retired | No (override with includeArchived) |
| \`cleared\` | Removed during grace period | No |

### Consumed pages

When Walker confirms knowledge is in the PKB:
1. Run Recall comparison (or /wiki-consumed command)
2. Page status → \`consumed\`
3. Frontmatter gains \`consumed_at\` and \`pkb_refs\`

### Reactivation

If a new source integrates into a consumed topic, the topic flips back to integrated. Consumed is a checkpoint, not a destination.

## Workflows

### Capture
1. Use wiki_capture_source to preserve the source packet.
2. Read the extracted content and summary page.
3. Improve the summary page first.
4. Only then update impacted topics.
5. Log integration when done.

### Query
1. Search the wiki first with wiki_search.
2. Read the most relevant pages.
3. Answer using summary page citations.

### Audit
1. Run wiki_lint for structural issues.
2. Then reason about semantic gaps, contradictions, and missing pages.
3. Report tensions before resolving them.
`;
}

// ── Bootstrap ────────────────────────────────────────────────

export async function bootstrapVault(root: string, title: string, domain?: string, force = false): Promise<string[]> {
  const configPath = join(root, ".wiki", "config.json");
  if (!force && (await hasWikiConfig(root))) {
    throw new Error(`Wiki already appears initialized at ${root}. Use force=true to overwrite scaffold files.`);
  }

  const created = [
    join(root, "inbox"),
    join(root, "pages", "summaries"),
    join(root, "pages", "topics"),
    join(root, "pages", "plans"),
    join(root, "pages", "reviews"),
    join(root, "meta"),
    join(root, "archive"),
    join(root, ".wiki", "templates"),
  ];

  for (const dir of created) {
    await mkdir(dir, { recursive: true });
  }

  await writeDefaultConfig(root, title, domain);

  const config = createDefaultConfig(title, domain);
  await writeFile(join(root, config.templates.summary), DEFAULT_SUMMARY_TEMPLATE, "utf8");
  await writeFile(join(root, config.templates.topic), DEFAULT_TOPIC_TEMPLATE, "utf8");
  await writeFile(join(root, config.templates.plan), DEFAULT_PLAN_TEMPLATE, "utf8");
  await writeFile(join(root, config.templates.review), DEFAULT_REVIEW_TEMPLATE, "utf8");

  await writeFile(join(root, "WIKI_SCHEMA.md"), defaultSchemaMarkdown(title, domain), "utf8");
  await writeFile(metaPath(root, "registry.json"), `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), pages: [] }, null, 2)}\n`, "utf8");
  await writeFile(metaPath(root, "backlinks.json"), `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), byPath: {} }, null, 2)}\n`, "utf8");
  await writeFile(metaPath(root, "index.md"), `# ${title} Index\n\n_No pages yet._\n`, "utf8");
  await writeFile(metaPath(root, "events.jsonl"), "", "utf8");
  await writeFile(metaPath(root, "log.md"), `# ${title} Log\n\n_No events yet._\n`, "utf8");
  await writeFile(metaPath(root, "lint-report.md"), `# Lint Report\n\n_No lint run yet._\n`, "utf8");

  return [toRelative(root, configPath), ...created.map((dir) => toRelative(root, dir))];
}

// ── Ensure Page ──────────────────────────────────────────────

export async function ensureCanonicalPage(
  root: string,
  config: WikiConfig,
  registry: RegistryData,
  params: EnsurePageParams,
): Promise<EnsurePageResult> {
  const targetType = params.type;
  const normalizedTitle = params.title.trim().toLowerCase();
  const normalizedAliases = new Set((params.aliases ?? []).map((alias) => alias.trim().toLowerCase()));

  const matches = registry.pages.filter((page) => {
    if (page.type !== targetType) return false;
    const pageNames = [page.title, ...page.aliases].map((value) => value.trim().toLowerCase());
    return (
      pageNames.includes(normalizedTitle) ||
      [...normalizedAliases].some((alias) => pageNames.includes(alias))
    );
  });

  if (matches.length > 1) {
    return {
      resolved: false,
      created: false,
      conflict: true,
      candidates: matches.map((page) => ({ id: page.id, path: page.path, title: page.title, type: page.type })),
    };
  }

  if (matches.length === 1) {
    const page = matches[0];
    return {
      resolved: true,
      created: false,
      conflict: false,
      path: page.path,
      id: page.id,
      title: page.title,
      type: page.type,
    };
  }

  if (params.createIfMissing === false) {
    return { resolved: false, created: false, conflict: false };
  }

  const now = new Date();
  const dateStamp = todayStamp(now);

  // Determine slug and filename based on type
  let slug: string;
  let absolutePath: string;

  if (targetType === "plan") {
    slug = params.date ?? dateStamp;
    absolutePath = canonicalPagePath(root, targetType, "Plan", slug);
  } else if (targetType === "review") {
    slug = params.period ?? `review`;
    absolutePath = canonicalPagePath(root, targetType, "Review", undefined, slug);
  } else {
    // topic
    const baseSlug = slugifyTitle(params.title);
    const existingSlugs = registry.pages
      .filter((page) => page.type === targetType)
      .map((page) => basename(page.path, ".md"));
    slug = dedupeSlug(baseSlug, existingSlugs);
    absolutePath = canonicalPagePath(root, targetType, slug);
  }

  const template = await readTemplate(join(root, config.templates[targetType]));
  const id = makePageId(targetType, slug, now);

  // Build template variables per type
  const templateValues: Record<string, string> = {
    id,
    title: params.title,
    updated: dateStamp,
    date: params.date ?? dateStamp,
    period: params.period ?? "",
  };
  const rendered = renderTemplate(template, templateValues);

  // Default status per type
  const defaultStatus = targetType === "topic" ? "draft" : "active";

  const parsed: Record<string, any> = {
    id,
    type: targetType,
    title: params.title,
    aliases: params.aliases ?? [],
    tags: params.tags ?? [],
    status: defaultStatus,
    updated: dateStamp,
    source_ids: [],
    summary: params.summary ?? "",
  };

  // Add type-specific fields
  if (targetType === "plan") {
    parsed.date = params.date ?? dateStamp;
  }
  if (targetType === "review") {
    parsed.period = params.period ?? "";
  }
  if (targetType === "topic") {
    // topics get no extra fields beyond the base set
  }

  const frontmatterStart = rendered.indexOf("---\n");
  const secondDelimiter = rendered.indexOf("\n---\n", frontmatterStart + 4);
  const body = secondDelimiter >= 0 ? rendered.slice(secondDelimiter + 5).trimStart() : rendered;

  await writePage(absolutePath, parsed, body);

  return {
    resolved: true,
    created: true,
    conflict: false,
    path: toRelative(root, absolutePath),
    id,
    title: params.title,
    type: targetType,
  };
}
