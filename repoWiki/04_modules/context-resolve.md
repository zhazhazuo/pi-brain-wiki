# Module: context-resolve

## Responsibility

Resolves checked-in external context registry entries to machine-local repo paths and returns a validated read-only descriptor.

## Entry Points

- extensions/brain-wiki/src/context-resolve.ts → `resolveExternalContext()`

## Key Files

- extensions/brain-wiki/src/context-resolve.ts → context lookup, env.local repo-key resolution, path validation

## Constraints

- Either `context_id` or `pkb_note` required; when both are provided they must refer to the same context
- Repo path must exist in `.wiki/env.local.json` under the context's `repo_key`
- Resolved path must be absolute, exist, and be a directory
- `seed_files`, `include_paths`, and `exclude_paths` are sanitized to safe relative paths
- Performs no repository exploration

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/context-resolve.ts | Registry lookup, env merge, path stat validation, relative path sanitization |
| Consumer | extensions/brain-wiki/index.ts | `wiki_context_resolve` tool handler |
| Consumer | extensions/brain-wiki/index.ts | `wiki_context_gather` calls resolve before gathering |
| Consumer | extensions/brain-wiki/src/config.ts | supplies `contexts` registry and `loadLocalEnvConfig` |
