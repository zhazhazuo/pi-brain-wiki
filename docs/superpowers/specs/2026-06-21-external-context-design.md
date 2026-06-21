# External Context Design

Date: 2026-06-21
Repository: `pi-brain-wiki`
Scope: Deterministic external-context resolution and bounded repository gathering for `brain-wiki`.

## Goal

Define a deterministic mechanism that lets `brain-wiki` use machine-local repository context when a PKB topic requires it, without hardcoding laptop-specific paths into synced notes or allowing uncontrolled repo exploration.

Concrete target example:

- PKB page: `Area/5 Work/53 Visable/Sales Tool Application.md`
- Desired capability: when that context is explicitly requested, `brain-wiki` can resolve the linked local repository on the current laptop and gather bounded architectural or implementation context from it.

## Current Context

The repository already has adjacent patterns that this design should extend rather than replace:

- graph-first PKB/wiki lookup through `graph.ts`
- deterministic project operations through `wiki_project_sync`
- workflow pages and route metadata for learned behavior
- checked-in wiki config via `.wiki/config.json`

Those patterns all favor explicit config, constrained tool surfaces, and fail-closed behavior.

## Non-Goals

- embedding machine-local repository paths in PKB note content
- automatic repo exploration whenever a note is merely mentioned
- semantic or open-ended retrieval across arbitrary local folders
- replacing PKB/wiki context with repository context as the default source of truth
- allowing agents to write into external repositories through this mechanism

## Design Principles

1. Shared meaning, local path resolution
   The meaning of a context is tracked in versioned config. The actual filesystem path is resolved locally per machine.

2. Explicit activation
   Repo-backed context must be requested. Mentioning a note alone is not sufficient to trigger repository inspection.

3. Deterministic exploration
   Repo gathering follows fixed intent-specific recipes rather than free-form browsing.

4. Fail closed
   Missing config, missing env mappings, invalid paths, or vague intents must produce structured errors instead of fallback guessing.

5. Read-only external context
   This feature gathers information from external repositories. It does not modify them.

## Recommended Approach

Use a three-layer model:

- PKB note metadata provides an optional stable context ID
- checked-in context registry defines what that context means and what repo capabilities are allowed
- untracked machine-local env config resolves repo keys to concrete local paths

This separation keeps synced note content portable across laptops while preserving deterministic operational behavior.

Alternatives rejected:

- storing repository alias and path directly in note metadata
  Rejected because it mixes content with machine-local execution concerns and does not travel cleanly across laptops.

- storing only free-form aliases in notes and resolving everything dynamically at runtime
  Rejected because dynamic lookup is too ambiguous and difficult to validate.

- using only a skill or standalone script
  Rejected because prompt behavior and scripts alone do not provide a typed, testable, fail-closed execution contract.

## Configuration Model

### 1. PKB note metadata

PKB notes may declare a stable context ID:

```yaml
brain_wiki_context: sales-tool-application
```

This metadata is optional but recommended for topics that have an associated external repository.

The note metadata does not contain:

- local filesystem paths
- per-laptop aliases
- execution behavior

### 2. Checked-in context registry

Add a checked-in config file dedicated to external contexts, for example:

```text
.wiki/contexts.json
```

Each entry is keyed by a stable context ID:

```json
{
  "sales-tool-application": {
    "label": "Sales Tool Application",
    "pkb_note": "Area/5 Work/53 Visable/Sales Tool Application.md",
    "repo_key": "sales_tool_application_repo",
    "allowed_intents": ["overview", "architecture", "implementation", "recent_changes", "question", "handoff"],
    "seed_files": ["README.md", "package.json"],
    "include_paths": ["src", "app", "docs"],
    "exclude_paths": ["node_modules", "dist", "build"],
    "search_terms": ["sales tool", "visable"],
    "notes": "Primary application repository for Sales Tool work."
  }
}
```

Registry responsibilities:

- define stable context IDs
- map context IDs to PKB anchors
- define the machine-independent repository key
- define allowed gather intents
- define bounded repo scope hints such as seed files and include/exclude paths

### 3. Machine-local env config

Add an untracked file for laptop-specific path resolution, for example:

```text
.wiki/env.local.json
```

Example:

```json
{
  "repos": {
    "sales_tool_application_repo": "/Users/walker/Code/sales-tool-application"
  }
}
```

Local env responsibilities:

- map repo keys to concrete absolute local paths
- vary across laptops
- remain out of version control

The extension should also provide a checked-in example file:

```text
.wiki/env.local.example.json
```

## Tool Surface

The primary mechanism should be extension tools, not skills.

### `wiki_context_resolve`

Purpose:
- resolve a context ID from explicit input or PKB note metadata
- load the checked-in context registry
- load the machine-local env config
- return a validated, fully resolved read-only context descriptor

Inputs:

- `context_id` optional
- `pkb_note` optional

At least one must be provided.

Outputs:

- `context_id`
- `label`
- `pkb_note`
- `repo_key`
- `repo_path`
- `allowed_intents`
- `seed_files`
- `include_paths`
- `exclude_paths`
- `search_terms`

This tool performs no repo exploration.

### `wiki_context_gather`

Purpose:
- gather bounded repository context for a resolved external context

Inputs:

- `context_id`
- `intent`
- `query` optional, required for `implementation` and `question`
- `limit_commits` optional for `recent_changes`

Outputs:

- `context_id`
- `repo_path`
- `intent`
- `files_read`
- `commands_used`
- `summary`
- `evidence`
- `limits_hit`
- `follow_up_suggestions`

This tool may internally use a subagent, but only behind a fixed exploration contract.

## Gather Intents

Initial supported intents:

- `overview`
- `architecture`
- `implementation`
- `recent_changes`
- `question`
- `handoff`

### `overview`

Goal:
- explain what the repo is, its main purpose, top-level structure, and tech stack

Recipe:
- read configured seed files first
- read top-level descriptive files such as `README*`
- read package/build manifests if present
- identify likely entrypoints
- summarize major directories and module responsibilities

### `architecture`

Goal:
- explain system boundaries, entrypoints, core flows, and important dependencies

Recipe:
- start from seed files or configured entrypoints
- inspect top-level module wiring and first-hop dependencies
- stop at the first meaningful layer unless config explicitly names deeper targets
- summarize components, relationships, and constraints

### `implementation`

Goal:
- locate and explain where a specific feature, symbol, or concept is implemented

Recipe:
- require a concrete `query`
- search for exact query matches first
- read the smallest set of files needed to explain the result
- stop once the answer is supported by file evidence

### `recent_changes`

Goal:
- summarize context-relevant recent repository changes

Recipe:
- inspect a bounded commit window
- rank changed files against include paths and search terms
- summarize only changes plausibly relevant to the active context

### `question`

Goal:
- answer one concrete user question using bounded repository context

Recipe:
- require a concrete question string
- map internally to one of the other recipes
- reject vague prompts such as "look around and tell me stuff"

### `handoff`

Goal:
- produce a compact continuation brief for another agent or later session

Recipe:
- gather only the files needed to explain active context, key findings, and next inspection targets
- output a concise structured summary rather than a broad repo overview

## Activation Model

Repository context is explicit, not ambient.

Valid activation paths:

- the caller explicitly provides a `context_id`
- the caller provides a PKB note and asks for repo-backed context
- a higher-level skill or workflow intentionally calls `wiki_context_resolve` followed by `wiki_context_gather`

Invalid activation path:

- the extension automatically exploring a repo just because the related PKB note appears in conversation

This preserves two modes of operation:

- PKB/wiki-only reasoning
- PKB/wiki plus repo-backed reasoning

## Determinism Rules

For the same:

- context registry entry
- local env mapping
- intent
- query

the tool should follow the same ordered recipe and produce the same output shape, except where filesystem contents or git history have materially changed.

Guardrails:

- start from configured seed files when present
- stay inside the resolved repo root
- respect include/exclude path constraints
- avoid recursive exploration beyond the recipe's defined bounds
- record files read and commands used
- return structured limits when a bound is hit

## Failure Modes

All failures must be explicit and structured.

Expected failures:

- context ID exists in note metadata but not in the checked-in registry
- registry entry exists but `repo_key` is missing from `.wiki/env.local.json`
- env mapping exists but the path does not exist on the current laptop
- env mapping path is not absolute
- requested intent is not allowed for that context
- `implementation` or `question` is missing a concrete query
- `question` intent is too vague to map to a bounded recipe

The extension must not:

- guess alternate paths
- downgrade silently into arbitrary workspace search
- read unrelated repositories

## Skills And Workflows

Skills remain useful as a routing layer, but not as the authoritative mechanism.

Recommended role of skills:

- detect when a user explicitly wants repo-backed context
- call `wiki_context_resolve`
- call `wiki_context_gather` with a matching intent
- weave the result back into wiki reasoning

The skill does not:

- resolve filesystem paths itself
- decide ad hoc repo boundaries
- perform uncontrolled exploration

## Security And Scope Constraints

- repo gathering is read-only
- repo gathering is restricted to paths explicitly configured for the resolved context
- local env config is machine-local and should be gitignored
- absolute local paths must never be written back into synced PKB notes
- external repo content may be summarized, but the extension should not mirror large source trees into the wiki

## Testing Strategy

Test in three layers.

### 1. Config resolution tests

Validate:

- note metadata to context ID resolution
- context registry lookup
- env-local repo key lookup
- absolute-path validation

### 2. Policy tests

Validate:

- allowed-intent enforcement
- fail-closed behavior for missing mappings
- rejection of vague `question` requests
- include/exclude path handling

### 3. Gather recipe tests

Validate:

- recipe-specific exploration order
- bounded file selection
- stable output shape
- correct evidence reporting

### 4. Extension integration tests

Keep a small number of end-to-end tests for:

- tool registration
- result formatting
- structured error behavior

## Implementation Shape

Likely additions:

- config support for external context registry and local env loading
- new module for context resolution
- new module for gather recipes and result formatting
- extension entry-point registration for `wiki_context_resolve` and `wiki_context_gather`
- tests for config, resolution, policy, and gather behavior
- example local env file and gitignore coverage

Suggested module split:

- `src/context-config.ts` or extend `src/config.ts` for schema loading
- `src/context-resolve.ts` for context and env resolution
- `src/context-gather.ts` for intent recipes and bounded exploration

## Open Decisions

These are intentionally constrained and should be finalized during implementation planning:

- whether external contexts live in `.wiki/contexts.json` or as a new section inside `.wiki/config.json`
- whether `wiki_context_gather` internally uses a subagent by default or only for selected intents
- the exact heuristics for rejecting vague `question` inputs

## Recommendation

Implement this as a deterministic extension capability centered on two tools:

- `wiki_context_resolve`
- `wiki_context_gather`

Use note metadata only as a stable pointer into checked-in context config, and use an untracked local env file for laptop-specific repo path resolution.

This gives `brain-wiki` a portable, explicit, testable way to bring external repository context into PKB-driven reasoning without weakening the existing deterministic design of the project.
