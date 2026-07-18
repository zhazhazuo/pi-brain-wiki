# workflow

## Responsibility

Generates standardized workflow pages from structured inputs. Creates `pages/workflows/` entries with YAML frontmatter, trigger-based routing metadata, and rendered body. Handles duplicate detection, slug deduplication, and conflict reporting against the existing registry.

## Entry Points

- `extensions/brain-wiki/src/workflow.ts` → `createWorkflow()` — main entry; validates, deduplicates, writes workflow page
- `extensions/brain-wiki/src/workflow.ts` → `renderWorkflowBody()` — render workflow body from structured params

## Key Files

- `extensions/brain-wiki/src/workflow.ts` → workflow creation, body rendering, conflict detection
- `extensions/brain-wiki/src/workflow.test.ts` → unit tests for generation, dedup, and rendering
- `extensions/brain-wiki/src/types.ts` → `WorkflowParams`, `WorkflowResult`, `WorkflowStatus`

## Constraints

- Workflow pages written to `{root}/pages/workflows/{slug}.md`
- Status values: `draft`, `active`, `archived`
- Triggers become aliases for routing
- Duplicate detection: matches on normalized title OR any trigger alias
- Version field: `WORKFLOW_VERSION = 1`
- Body includes embedded YAML block with all workflow metadata
- Summary auto-derived from first sentence of `goal` if not provided

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/workflow.ts` | Workflow creation, body rendering, conflict detection |
| Consumer | `extensions/brain-wiki/index.ts` | Wires `wiki_generate_workflow` tool handler |
| Consumer | `extensions/brain-wiki/src/indexer.ts` | Indexes workflow pages in registry |
