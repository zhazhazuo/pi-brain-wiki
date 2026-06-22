# External Context Setup

Use when linking a PKB note to a local repository for the first time, or when resolve fails with unknown context / missing env mapping.

## Step 1 — Collect inputs from Walker

Required:
- PKB note path (vault-relative, e.g. `Area/5 Work/53 Visable/Sales Tool Application.md`)
- Absolute local repo path on this machine (must exist and be a directory)
- Human label (e.g. `Sales Tool Application`)

Optional (infer from repo when possible):
- `seed_files` — start with `README.md`, `package.json`, and main config manifest
- `include_paths` — e.g. `app`, `src`, `server`, `docs`
- `exclude_paths` — e.g. `node_modules`, `dist`, `.nuxt`, `build`, `coverage`
- `search_terms` — short phrases for repo search recipes

## Step 2 — Choose a stable context id

- Lowercase kebab-case slug derived from the system name
- Example: `sales-tool-application`
- Must match `brain_wiki_context` on the PKB note

## Step 3 — Choose a repo key

- Snake_case machine-independent alias
- Example: `sales_tool_application_repo`
- Used only in config + env files, never in PKB body text

## Step 4 — Update `.wiki/config.json`

Add under `contexts`:

```json
"sales-tool-application": {
  "label": "Sales Tool Application",
  "pkb_note": "Area/5 Work/53 Visable/Sales Tool Application.md",
  "repo_key": "sales_tool_application_repo",
  "allowed_intents": [
    "overview",
    "architecture",
    "implementation",
    "recent_changes",
    "question",
    "handoff"
  ],
  "seed_files": ["README.md", "package.json", "nuxt.config.ts"],
  "include_paths": ["app", "server", "docs"],
  "exclude_paths": ["node_modules", "dist", ".nuxt"],
  "search_terms": ["sales tool", "visable"],
  "notes": "Short operator note for agents."
}
```

Required fields: `label`, `pkb_note`, `repo_key`, `allowed_intents`.

## Step 5 — Update `.wiki/env.local.json`

Create or merge (file is machine-local, do not commit):

```json
{
  "repos": {
    "sales_tool_application_repo": "/absolute/path/to/repo"
  }
}
```

Copy from `.wiki/env.local.example.json` if the file does not exist.

## Step 6 — Add PKB frontmatter pointer

On the PKB note in `Area/` (not a wiki topic page):

```yaml
brain_wiki_context: sales-tool-application
```

Do not add local paths to frontmatter or body.

## Step 7 — Verify

```
wiki_context_resolve({ pkb_note: "<vault-relative-pkb-path>" })
```

Confirm `repo_path` matches Walker's machine. If resolve fails, fix config before gather.

## Step 8 — Log (optional)

If Walker wants the setup recorded:

```
wiki_log_event({ kind: "integrate", title: "Linked external context: <label>", notes: ["context:<context-id>"] })
```
