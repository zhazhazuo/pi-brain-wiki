# Taskwarrior Decouple + Workshop Socratic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple Taskwarrior from LIST.md (read-only data source + validated writes + format assist) and rebuild the workshop around Socratic questions instead of content summarization.

**Architecture:** Spec: `docs/superpowers/specs/2026-07-28-taskwarrior-workshop-redesign-design.md`. Part 1 deletes the sync/scan modules and rewires `index.ts`; skill prose supplies the new read-state → draft → confirm → add loop. Part 2 changes the summary template into a learning record (Core claim + Discussion) and rewrites workshop protocol prose. No new tools.

**Tech Stack:** TypeScript extension (Node strip-types), Bun test (`bun test`), pi skill files (markdown).

## Global Constraints

- Run tests with `bun test extensions/brain-wiki/src/` (tests import `bun:test`; plain `node --test` FAILS with `ERR_UNSUPPORTED_ESM_URL_SCHEME`).
- Run package sanity with `npm run check` (validates skill loading; it does NOT run unit tests).
- Do not change `wiki_integrate_source` validation (Bridge / edges / integration targets stay as-is).
- Do not touch `skills/taskwarrior/instructions/creation-rules.md` — the format knowledge is the asset.
- Existing summary pages and existing vaults are untouched; template change affects new captures only.
- Progress file: `.ai-artifacts/progress/taskwarrior-workshop-redesign.md` — update Current State after each task.

---

### Task 1: Extension decouple — remove LIST.md ↔ Taskwarrior binding

**Files:**

- Delete: `extensions/brain-wiki/src/task-sync.ts`
- Delete: `extensions/brain-wiki/src/task-sync.test.ts`
- Delete: `extensions/brain-wiki/src/task-scan.ts`
- Delete: `extensions/brain-wiki/src/task-scan.test.ts`
- Modify: `extensions/brain-wiki/index.ts` (imports ~lines 67-84; `wiki_task` registration ~1316-1356; `wiki_task_scan` registration ~1358-1397; `wiki_week` handler ~1399-1428; `formatScanResult` ~1975-1997; `handleWikiTaskAction` ~1999-2230)

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: `handleWikiTaskAction(pi, params)` — two-parameter signature; no `wiki_task_scan` tool exists after this task; `wiki_week` details object is `{ path, text: md }` (no `syncResult`).

- [ ] **Step 1: Remove dead imports**

In `extensions/brain-wiki/index.ts` delete these lines:

```ts
import { scanVaultForTasks } from "./src/task-scan.ts";
import {
  markListItemPromoted,
  syncCompletedTasksToList,
} from "./src/task-sync.ts";
```

Also remove `ScanProposal,` from the `} from "./src/types.ts";` import block (line ~67).

- [ ] **Step 2: Reword `wiki_task` registration metadata**

Replace:

```ts
    promptSnippet:
      "Promote LIST.md items into validated Taskwarrior tasks, annotate existing tasks, or mark tasks complete",
    promptGuidelines: [
      "Use graph and vault search first when the task is derived from a source or wiki topic.",
      "Use promote action when creating new tasks from LIST.md or scan proposals.",
      "Use annotate action to add wiki links or context notes to existing tasks.",
      "Use done action to mark a task complete.",
    ],
```

with:

```ts
    promptSnippet:
      "Create validated Taskwarrior tasks from a confirmed draft, annotate existing tasks, or mark tasks complete",
    promptGuidelines: [
      "Use graph and vault search first when the task is derived from a source or wiki topic.",
      "Use promote action only after Walker confirms the drafted task.",
      "Use annotate action to add wiki links or context notes to existing tasks.",
      "Use done action to mark a task complete.",
    ],
```

And replace the `source` parameter description:

```ts
      source: Type.Optional(
        Type.String({
          description: "Source reference, e.g. LIST.md:2026-06-01:item-3",
        }),
      ),
```

with:

```ts
      source: Type.Optional(
        Type.String({
          description: "Source reference, e.g. a wiki page path or external URL",
        }),
      ),
```

- [ ] **Step 3: Simplify `wiki_task` execute body**

Replace:

```ts
      const root = await resolveWikiRoot(_ctx.cwd);
      const client = await getObsidianClient(root);
      return handleWikiTaskAction(pi, params, root, client) as any;
```

with:

```ts
      return handleWikiTaskAction(pi, params) as any;
```

- [ ] **Step 4: Delete the entire `wiki_task_scan` registration**

Remove the whole block from `pi.registerTool({` with `name: "wiki_task_scan",` through its closing `});` (includes the `syncCompletedTasksToList` + `scanVaultForTasks` calls and the `formatScanResult` call).

- [ ] **Step 5: Strip the sync from `wiki_week`**

Replace the full `wiki_week` execute body:

```ts
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
```

with:

```ts
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const vaultRoot = resolve(root, "..");
      const runner = {
        exec: (command: string, args?: string[], options?: unknown) =>
          pi.exec(command, args, options),
      };
      const records = await taskExport(
        runner,
        "status:pending or status:completed",
      );
      const md = renderWeekMd(records);
      const path = await writeWeekMd(vaultRoot, md);
      return {
        content: [{ type: "text", text: `WEEK.md refreshed at ${path}` }],
        details: { path, text: md },
      };
    },
```

- [ ] **Step 6: Delete `formatScanResult`**

Remove the whole function:

```ts
function formatScanResult(
  proposals: ScanProposal[],
  syncResult?: { markedDone: number; errors: string[] },
): string {
  ...
}
```

- [ ] **Step 7: Remove LIST.md marking from the promote flow and simplify the signature**

Replace:

```ts
async function handleWikiTaskAction(
  pi: ExtensionAPI,
  params: Record<string, unknown>,
  _root: string,
  client: ObsidianClient | null,
) {
```

with:

```ts
async function handleWikiTaskAction(
  pi: ExtensionAPI,
  params: Record<string, unknown>,
) {
```

And replace:

```ts
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
```

with:

```ts
    // Annotate source reference
    if (taskId && params.source) {
      const source = String(params.source);
      await taskExec(runner, [String(taskId), "annotate", `source: ${source}`]);
    }
```

- [ ] **Step 8: Delete the module files**

```bash
rm extensions/brain-wiki/src/task-sync.ts \
   extensions/brain-wiki/src/task-sync.test.ts \
   extensions/brain-wiki/src/task-scan.ts \
   extensions/brain-wiki/src/task-scan.test.ts
```

- [ ] **Step 9: Verify no dangling references and run the suite**

```bash
grep -rn "task-sync\|task-scan\|scanVaultForTasks\|syncCompletedTasksToList\|markListItemPromoted\|formatScanResult\|ScanProposal\|wiki_task_scan" extensions/ && echo "DANGLING REFS" || echo "clean"
bun test extensions/brain-wiki/src/
```

Expected: `clean`; all tests pass (`index.context-tools.test.ts` imports `../index.ts`, so any broken import fails here).

- [ ] **Step 10: Commit**

```bash
git add -A extensions/
git commit -m "refactor: decouple Taskwarrior from LIST.md — remove task-sync, task-scan, wiki_task_scan"
```

---

### Task 2: Summary template becomes a learning record

**Files:**

- Test: `extensions/brain-wiki/src/scaffold.test.ts` (new)
- Modify: `extensions/brain-wiki/src/scaffold.ts:13-64` (`DEFAULT_SUMMARY_TEMPLATE`)

**Interfaces:**

- Consumes: nothing.
- Produces: `DEFAULT_SUMMARY_TEMPLATE` with sections in this order: Source at a glance, Core claim, Bridge, Discussion, Reliability / caveats, Integration targets, Edges, Open questions, Related pages. `lint.ts` and `integration.ts` only check Bridge / Integration targets / edges — no changes needed there.

- [ ] **Step 1: Write the failing test**

Create `extensions/brain-wiki/src/scaffold.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { DEFAULT_SUMMARY_TEMPLATE } from "./scaffold.ts";

describe("DEFAULT_SUMMARY_TEMPLATE", () => {
  test("is a learning record, not a content summary", () => {
    expect(DEFAULT_SUMMARY_TEMPLATE).toContain("## Core claim");
    expect(DEFAULT_SUMMARY_TEMPLATE).toContain("## Bridge");
    expect(DEFAULT_SUMMARY_TEMPLATE).toContain("## Discussion");
    expect(DEFAULT_SUMMARY_TEMPLATE).toContain("## Integration targets");
  });

  test("drops plain-summary sections", () => {
    expect(DEFAULT_SUMMARY_TEMPLATE).not.toContain("## Executive summary");
    expect(DEFAULT_SUMMARY_TEMPLATE).not.toContain("## Main claims");
    expect(DEFAULT_SUMMARY_TEMPLATE).not.toContain(
      "## Important details and data points",
    );
    expect(DEFAULT_SUMMARY_TEMPLATE).not.toContain(
      "## Entities and concepts mentioned",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/scaffold.test.ts`
Expected: FAIL — `## Core claim` not found.

- [ ] **Step 3: Rewrite the template**

In `extensions/brain-wiki/src/scaffold.ts`, replace everything inside `DEFAULT_SUMMARY_TEMPLATE` after the frontmatter closing `---` (i.e. from `# {{title}}` to the end of the template literal) with:

````markdown
# {{title}}

## Source at a glance

## Core claim
2-3 sentences: the single claim or model this source advances.
Walker has read the source — do not summarize its content here.

## Bridge

**What you already know:** PKB notes this source connects to, cited by path.

**What is genuinely new:** what this source adds, refines, or contradicts.

**Where the edge is:** the tension, gap, or extension at the knowledge boundary.

## Discussion
The Phase 4 Q&A record: questions asked, Walker's compressed answers,
ideas generated.

## Reliability / caveats

## Integration targets
- [[topics/...]] — what this source affects

## Edges
Record each knowledge-boundary question in frontmatter \`edges:\` as
\`- id: edge-N, text: ..., state: open|exploring|resolved\`.

## Open questions

## Related pages
````

(Keep the frontmatter block above `# {{title}}` unchanged, including the `edges: []` line.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test extensions/brain-wiki/src/scaffold.test.ts && bun test extensions/brain-wiki/src/`
Expected: PASS, whole suite green.

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/scaffold.ts extensions/brain-wiki/src/scaffold.test.ts
git commit -m "feat: summary template becomes a learning record (Core claim + Discussion)"
```

---

### Task 3: Rewrite the taskwarrior skill

**Files:**

- Modify: `skills/taskwarrior/SKILL.md` (full rewrite)
- Modify: `skills/taskwarrior/instructions/session-workflow.md` (full rewrite)

**Interfaces:**

- Consumes: Task 1 (`wiki_task_scan` no longer exists).
- Produces: skill triggers and workflow that never mention LIST.md draining, scanning, or bidirectional task↔wiki linking.

- [ ] **Step 1: Rewrite `skills/taskwarrior/SKILL.md`**

Full new content:

```markdown
---
name: taskwarrior
description: Manages tasks via Taskwarrior CLI. Use when drafting new tasks from plain-words descriptions, refreshing the weekly dashboard, or annotating and completing tasks.
---

# Taskwarrior Workflow

Taskwarrior is the shared temporal task database. The wiki treats it as a read-only data source plus a validated write endpoint. There is no link between Taskwarrior and LIST.md.

## Triggers

Load this skill when the user says:
- "make this a task" / "help me phrase this task" / "draft a task for X"
- "what's on this week" / "weekly view" / "refresh WEEK.md"
- "mark task done" / "complete this task"
- "annotate task" / "add note to task"

## Sub-files

| File | When to load |
|------|-------------|
| `instructions/creation-rules.md` | Before drafting any task. Project format, TYPE prefix, validation rules, agent write rules |
| `instructions/session-workflow.md` | Session start/end. Read-state → draft → confirm → add loop |

## Tools

| Tool | Action | Example |
|------|--------|---------|
| `wiki_task(action: "promote")` | Create validated task from a confirmed draft | `description`, `project`, `scheduled`, `priority`, `estimate`, `tags` required |
| `wiki_task(action: "annotate")` | Add note to task | `taskId`, `text` required |
| `wiki_task(action: "done")` | Complete task | `taskId` required |
| `wiki_week()` | Refresh WEEK.md | No params |

## Quick Reference

**Always:**
- Read real Taskwarrior state before drafting (`task export`, `task projects`, `task tags`)
- Validate all fields against `creation-rules.md` before proposing
- Propose the draft to Walker, never auto-create
- Chain split tasks with `depends:`

**Never:**
- Modify core fields without Walker's instruction
- Delete tasks
- Un-complete tasks
- Create unscheduled tasks
- Touch LIST.md — it is a plain inbox, not part of the task flow
```

- [ ] **Step 2: Rewrite `skills/taskwarrior/instructions/session-workflow.md`**

Full new content:

````markdown
# Session Workflow

## The loop: read state → draft → confirm → add

```
Session start (optional)
  └── wiki_week() → refresh the weekly dashboard

Format assist
  ├── 1. Read state: gather real context with read-only CLI
  │     - task projects                 → existing Domain.Outcome projects
  │     - task tags                     → the tag vocabulary in use
  │     - task export status:pending    → current load, scheduled patterns, estimates
  ├── 2. Draft: shape Walker's plain-words description per creation-rules.md
  │     - reuse an existing project when one fits; propose a new
  │       Domain.SpecificOutcome only when nothing matches
  │     - reuse existing tags; TYPE prefix → default tag mapping
  │     - present the full field set: description, project, scheduled,
  │       priority, estimate, tags (+ due/depends when relevant)
  ├── 3. Confirm: Walker approves or adjusts the draft
  └── 4. Add: wiki_task(action: "promote") with the confirmed fields

During session
  ├── Walker: "annotate task N" → wiki_task(annotate)
  └── Work completed → wiki_task(done)

Session end (optional)
  └── wiki_week() → refresh WEEK.md
```

## Drafting guidance

- Ground every draft in the read state. A draft that invents a project or
  tag Walker never uses is a failed draft.
- If Walker's description maps to an existing pending task, say so instead
  of drafting a duplicate.
- If the estimate would exceed 3 days, propose a split chain per
  creation-rules.md before drafting.
````

- [ ] **Step 3: Verify skill loading**

Run: `npm run check`
Expected: `pi-brain-wiki sanity check passed`.

- [ ] **Step 4: Commit**

```bash
git add skills/taskwarrior/
git commit -m "skill: taskwarrior becomes read-state format assist, LIST.md flow removed"
```

---

### Task 4: Rewrite the wiki-workshop skill around questions

**Files:**

- Modify: `skills/wiki-workshop/SKILL.md`
- Modify: `skills/wiki-workshop/instructions/protocol.md`
- Modify: `skills/wiki-workshop/instructions/platform.md`
- Modify: `skills/wiki-workshop/instructions/rules.md`
- Modify: `skills/wiki-workshop/instructions/checklist.md`

**Interfaces:**

- Consumes: Task 2 (template now has Core claim + Discussion).
- Produces: Phase 4 named "Questions & Brainstorm"; no phase reports source content back to Walker.

- [ ] **Step 1: Update `skills/wiki-workshop/SKILL.md`**

In the intro paragraph, replace:

```markdown
You are the **Workshop Agent**, a supervised thinking partner covering the full learning loop: Walker brings you sources, and together you disassemble them, connect them to what's already known, record the knowledge-boundary **edges**, and write the synthesized understanding back to the wiki. Later, the same skill graduates that knowledge into Walker's PKB and closes the edges. You are not autonomous — you discuss, propose, and confirm with Walker before writing.
```

with:

```markdown
You are the **Workshop Agent**, a supervised thinking partner covering the full learning loop: Walker brings you sources **he has already read**, and together you connect them to what's already known, record the knowledge-boundary **edges**, and write the synthesized understanding back to the wiki. Later, the same skill graduates that knowledge into Walker's PKB and closes the edges. You are not autonomous — you ask questions, discuss, and confirm with Walker before writing. Never re-summarize the source for Walker; your job is connection and probing questions, not content delivery.
```

In the Sub-files table, replace the protocol.md row:

```markdown
| `instructions/protocol.md` | Ingest mode. The 5 phases: receive → orient → understand & connect → discuss → write |
```

with:

```markdown
| `instructions/protocol.md` | Ingest mode. The 5 phases: receive → orient → understand & connect → questions & brainstorm → write |
```

In Quick Reference **Always**, replace:

```markdown
- Build the platform in Phase 3 before discussing takeaways — supervised distillation starts from a shared understanding, not a raw source
```

with:

```markdown
- Build the platform in Phase 3 before the Phase 4 questions — supervised distillation starts from a shared understanding, not a raw source
```

and replace:

```markdown
- Discuss key takeaways with Walker before writing (Phase 4 is mandatory)
```

with:

```markdown
- Ask Walker 2-5 edge-focused questions before writing (Phase 4 is mandatory)
```

In Quick Reference **Never**, replace:

```markdown
- Skip the discussion phase — supervised distillation is the point
```

with:

```markdown
- Skip the question phase — the Socratic discussion is the point
- Report the source's content back to Walker — he has read it
```

- [ ] **Step 2: Update `instructions/protocol.md` Phase 1**

Replace the Phase 1 block:

```markdown
## Phase 1: Receive Source

Walker provides a source (URL, file, or text). Can come directly or from LIST.md.

```

1. wiki_capture_source → creates inbox packet + summary stub
2. Read the extracted content → understand the source
3. Tell Walker: "Here's what I got from this source."
4. Classify the source weight (Trivial / Substantial / Heavy) per platform.md and announce it.
   Walker may override.

```

with:

```markdown
## Phase 1: Receive Source

Walker provides a source (URL, file, or text). Can come directly or from LIST.md.
**Walker has already read the source.** Your reading is for grounding — never
report the content back to him.

```

1. wiki_capture_source → creates inbox packet + summary stub
2. Read the extracted content → ground yourself in the source (internal)
3. Classify the source weight (Trivial / Substantial / Heavy) per platform.md and announce it.
   Walker may override.

```

(Keep the remaining numbered items of Phase 1 — the LIST.md agent line and item toggling — unchanged.)

- [ ] **Step 3: Update `instructions/protocol.md` Phase 3 intro and steps**

Replace:

```markdown
```

3.1 Explain the new content at concept level (teach, don't paraphrase)
3.2 Search the PKB per brain-wiki's instructions/mini-search.md
    - Load mini-search.md if not loaded; ensure PARA scopes indexed
    - ctx_search with terms drawn from 3.1, 2-4 per query, batched in one call
    - Collect windows with file paths; do not read full PKB files unless a window is ambiguous
3.3 Build the platform: "what you already know" + "what is genuinely new" + "where the edge is"
    - Cite PKB paths for every "what you already know" claim
3.4 Present the platform and invite Walker's reaction
    - Soft gate for additive sources
    - Hard gate if the source contradicts PKB/wiki, implies a new topic, or the edge is ambiguous

```
```

with:

```markdown
```

3.1 Ground yourself in the source at concept level (internal — Walker has read it;
    build your own model of its claims, concepts, and tensions)
3.2 Search the PKB per brain-wiki's instructions/mini-search.md
    - Load mini-search.md if not loaded; ensure PARA scopes indexed
    - ctx_search with terms drawn from 3.1, 2-4 per query, batched in one call
    - Collect windows with file paths; do not read full PKB files unless a window is ambiguous
3.3 Build the platform: "what you already know" + "what is genuinely new" + "where the edge is"
    - Cite PKB paths for every "what you already know" claim
3.4 Compress the platform into a short frame (3-6 lines) and derive the
    Phase 4 questions from it
    - Soft gate for additive sources
    - Hard gate if the source contradicts PKB/wiki, implies a new topic, or the edge is ambiguous

```
```

- [ ] **Step 4: Replace `instructions/protocol.md` Phase 4**

Replace the entire Phase 4 section:

```markdown
## Phase 4: Discuss Key Takeaways

Grounded in the platform, discuss what this source means for the wiki:

```

1. Present Walker with: "Here are the key takeaways I see from this source."
2. Present Integration Targets: "This source should affect these topic pages: [list]"
3. If the source is additive and the targets are clear, state the intended edits and continue to write.
4. If the source is contradictory, ambiguous, or implies a new topic, ask Walker for confirmation before writing.
   (These are the same hard-gate conditions from Phase 3.4 — resolve them here with Walker.)

```
```

with:

````markdown
## Phase 4: Questions & Brainstorm

Walker has read the source. Do not present takeaways — ask questions that move
his understanding. Grounded in the platform:

```
1. Present the compressed platform (3-6 lines: known / new / edge).
2. Ask 2-5 probing questions aimed at the edge:
   - tensions between the source and the cited PKB entries
   - what the source's claims imply for Walker's projects or existing notes
   - what struck Walker in the source, and whether it matches the edge you identified
   - applications or ideas the source opens up
3. Discuss Walker's answers. Refine the Bridge; capture ideas as they emerge.
4. Present Integration Targets: "This source should affect these topic pages: [list]"
5. Hard gate unchanged: if the source contradicts PKB/wiki, implies a new topic,
   or the edge is ambiguous, wait for Walker's direction before writing.
6. State the intended edits (summary page + integration targets) and continue.
```
````

(Keep the "Hard gate" paragraph after the block unchanged.)

- [ ] **Step 5: Update `instructions/protocol.md` Phase 5 item 1**

Replace:

```markdown
1. Write or update the summary page (full content), including:
   - `## Bridge` section — the platform from Phase 3 (already known / genuinely new / where the edge is), with PKB citations
   - frontmatter `edges:` — one entry per knowledge-boundary question: id, text, state (open|exploring), optional targets, created date
   - `## Integration targets` — concrete page links, no `[[topics/...]]` placeholders
```

with:

```markdown
1. Write or update the summary page (a learning record, not a content summary), including:
   - `## Core claim` — 2-3 sentences: the single claim or model the source advances
   - `## Bridge` — the platform refined by the Phase 4 discussion, with PKB citations
   - `## Discussion` — the Phase 4 record: questions asked, Walker's compressed answers, ideas generated
   - frontmatter `edges:` — one entry per knowledge-boundary question: id, text, state (open|exploring), optional targets, created date
   - `## Integration targets` — concrete page links, no `[[topics/...]]` placeholders
```

- [ ] **Step 6: Update `instructions/platform.md`**

Replace the 3.1 heading and first paragraph:

```markdown
### 3.1 Explain the new content

Produce a concept-level synthesis of the source. Not a paraphrase. Not a filing. Teach Walker what the source actually says at the level of ideas:
```

with:

```markdown
### 3.1 Ground yourself in the new content

Produce a concept-level synthesis of the source **for yourself**. Walker has already read it — this is your grounding, not a teaching block. Not a paraphrase. Not a filing. Model what the source actually says at the level of ideas:
```

and replace its output line:

```markdown
Output: a short explain block, in plain teaching voice, scoped to what the source genuinely contributes.
```

with:

```markdown
Output: an internal concept model, scoped to what the source genuinely contributes. It feeds 3.3 and the Phase 4 questions; it is not presented to Walker as content.
```

Replace the 3.4 section body:

```markdown
### 3.4 Present and invite reaction

Present the platform to Walker and explicitly invite reaction before Phase 4:

> "Here is the platform I built from this source against your existing notes. Does this match how you understand the edge? Should I reframe anything before we discuss takeaways?"
```

with:

```markdown
### 3.4 Compress the platform and derive questions

Compress the platform into a short frame (3-6 lines: known / new / edge) — this is what Walker sees in Phase 4. Then derive 2-5 probing questions from the edge. A good edge question:

- targets a tension between the source and a cited PKB entry, or
- asks what the source's claims imply for Walker's projects or notes, or
- asks what struck Walker and whether it matches the edge you identified, or
- opens an application or idea the source makes possible.
```

In "What the platform is NOT", replace:

```markdown
- **Not autonomous.** 3.4 always invites Walker's reaction before Phase 4.
```

with:

```markdown
- **Not autonomous.** The Phase 4 questions always put Walker in the conversation before any writing.
```

- [ ] **Step 7: Update `instructions/rules.md`**

In rule 2, replace:

```markdown
Every ingest runs Phase 3 (Understand & Connect) before Phase 4 (Discuss) and Phase 5 (Write). The platform teaches the new content at concept level and connects it to what Walker already knows via PKB search (`brain-wiki/instructions/mini-search.md`). Skipping Phase 3 reverts the workshop to filing.
```

with:

```markdown
Every ingest runs Phase 3 (Understand & Connect) before Phase 4 (Questions & Brainstorm) and Phase 5 (Write). The platform grounds the agent and connects the source to what Walker already knows via PKB search (`brain-wiki/instructions/mini-search.md`); it feeds the Phase 4 questions and persists as the Bridge. Skipping Phase 3 reverts the workshop to filing.
```

In rule 8, replace:

```markdown
- Length targets: summaries 20-40 lines, topics 5-20 lines
```

with:

```markdown
- Length targets: summaries 15-30 lines (learning record, no content summary), topics 5-20 lines
```

- [ ] **Step 8: Update `instructions/checklist.md`**

Replace:

```markdown
- [ ] Read extracted content → understand the source
```

with:

```markdown
- [ ] Read extracted content → ground yourself (Walker has read it; no report-back)
```

Replace:

```markdown
- [ ] 3.1 Explain the new content at concept level (teach, don't paraphrase)
```

with:

```markdown
- [ ] 3.1 Ground yourself in the source at concept level (internal)
```

Replace:

```markdown
- [ ] 3.4 Present the platform and invite Walker's reaction (soft gate; hard gate if contradictory/new-topic/ambiguous)
```

with:

```markdown
- [ ] 3.4 Compress the platform to 3-6 lines; derive the Phase 4 questions
```

Replace the Phase 4 block:

```markdown
- [ ] **Phase 4 — Discuss:**
- [ ] Present key takeaways
- [ ] Present Integration Targets
- [ ] Get Walker confirmation only if the source is contradictory, ambiguous, or introduces a new topic
```

with:

```markdown
- [ ] **Phase 4 — Questions & Brainstorm:**
- [ ] Present the compressed platform (3-6 lines: known / new / edge)
- [ ] Ask 2-5 edge-focused questions
- [ ] Discuss Walker's answers; refine the Bridge; capture ideas
- [ ] Present Integration Targets
- [ ] Hard gate: contradictory / new-topic / ambiguous → wait for Walker
```

Replace:

```markdown
- [ ] Write/update summary page with full content, including:
- [ ] `## Bridge` section — the Phase 3 platform (known / new / edge), with PKB citations
```

with:

```markdown
- [ ] Write/update summary page (learning record), including:
- [ ] `## Core claim` — 2-3 sentences on the source's single claim or model
- [ ] `## Bridge` section — the platform refined by Phase 4, with PKB citations
- [ ] `## Discussion` section — questions asked, Walker's compressed answers, ideas
```

- [ ] **Step 9: Verify skill loading**

Run: `npm run check`
Expected: `pi-brain-wiki sanity check passed`.

- [ ] **Step 10: Commit**

```bash
git add skills/wiki-workshop/
git commit -m "skill: workshop becomes Socratic — questions replace content summary"
```

---

### Task 5: Shared skill table, README, final verification

**Files:**

- Modify: `skills/brain-wiki/SKILL.md:77-79`
- Modify: `README.md:67`
- Modify: `.ai-artifacts/progress/taskwarrior-workshop-redesign.md`

**Interfaces:**

- Consumes: Tasks 1-4.
- Produces: no API changes; docs consistent with the new behavior.

- [ ] **Step 1: Update `skills/brain-wiki/SKILL.md` tool table**

Replace:

```markdown
| `wiki_task` | Taskwarrior: promote/annotate/done (load `taskwarrior` skill) |
| `wiki_task_scan` | Taskwarrior: scan vault for task proposals |
| `wiki_week` | Taskwarrior: refresh WEEK.md dashboard |
```

with:

```markdown
| `wiki_task` | Taskwarrior: create from confirmed draft / annotate / done (load `taskwarrior` skill) |
| `wiki_week` | Taskwarrior: refresh WEEK.md dashboard |
```

- [ ] **Step 2: Update README page-model row**

Replace:

```markdown
| `summary` | Per-source distillation | Source at a glance, Executive summary, Main claims, Integration targets |
```

with:

```markdown
| `summary` | Per-source learning record | Source at a glance, Core claim, Bridge, Discussion, Integration targets |
```

- [ ] **Step 3: Full verification**

```bash
bun test extensions/brain-wiki/src/
npm run check
grep -rn "wiki_task_scan" skills/ README.md extensions/ && echo "DANGLING" || echo "clean"
```

Expected: suite green; sanity check passed; `clean`.

- [ ] **Step 4: Update the live vault template (manual, outside this repo)**

Captures read the vault's own template file, so Walker's real vault keeps the old template until updated. Copy the new `DEFAULT_SUMMARY_TEMPLATE` body from `extensions/brain-wiki/src/scaffold.ts` into `<vault>/Wiki/.wiki/templates/summary.md` (same section list: Source at a glance, Core claim, Bridge, Discussion, Reliability / caveats, Integration targets, Edges, Open questions, Related pages).

- [ ] **Step 5: Update the progress file**

In `.ai-artifacts/progress/taskwarrior-workshop-redesign.md`: set Current State to "All five tasks landed; suite + sanity green. Live validation pending: one workshop session and one format-assist session in daily use." Leave Status `active` until live validation passes.

- [ ] **Step 6: Commit**

```bash
git add skills/brain-wiki/SKILL.md README.md .ai-artifacts/progress/
git commit -m "docs: align brain-wiki skill table and README with decoupled taskwarrior + socratic workshop"
```

---

## Self-Review Notes

- **Spec coverage:** Part 1 removals → Task 1; format-assist loop → Tasks 1+3; WEEK.md kept read-only → Task 1 Step 5. Part 2 template → Task 2; protocol/platform/rules/checklist → Task 4; README → Task 5; deferred items (lint, analysis, digest tool, tool-level Discussion enforcement, repoWiki regen) intentionally have no tasks.
- **Type consistency:** `handleWikiTaskAction(pi, params)` signature used identically in Steps 3 and 7 of Task 1; `wiki_week` details `{ path, text: md }` matches Step 5.
- **Known non-goal:** `repoWiki/` docs are generated and go stale after this change; regenerate them separately after implementation lands.
