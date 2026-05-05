# Module: paths

## Responsibility

Resolves the wiki root directory by walking upward from cwd and checking for .wiki/config.json (with fallback to Wiki/ or wiki/ subdirectories). Computes all vault paths (inbox, pages, meta, archive, canonical page paths, lock file, generated metadata files).

## Entry Points

- extensions/brain-wiki/src/paths.ts → resolveWikiRoot(), maybeResolveWikiRoot()

## Key Files

- extensions/brain-wiki/src/paths.ts → all path resolution logic

## Constraints

- Root discovery walks upward from cwd, checking each level for .wiki/config.json (direct, then Wiki/, then wiki/)
- Explicit root path can be provided as override
- All vault paths are derived from the resolved root — no hardcoded absolute paths
- Wiki links are validated against known page type prefixes (summaries/, topics/, plans/, reviews/)
- PARA links (Resource/, Project/, Area/, Archive/, Draft/) are acknowledged but not flagged

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/paths.ts | resolveWikiRoot(): upward walk with subdirectory fallback; canonicalPagePath(): computes canonical file paths per page type; metaPath(), lockPath(), sourcePacketDir() |
| Consumer | extensions/brain-wiki/index.ts | all tool handlers call resolveWikiRoot() or maybeResolveWikiRoot() to locate the vault |
| Consumer | extensions/brain-wiki/src/guards.ts | uses resolveWikiRoot() to check protected paths |
| Consumer | extensions/brain-wiki/src/lint.ts | uses path utilities for lint checks |
