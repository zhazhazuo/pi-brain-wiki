# Module: digest

## Responsibility

Builds and persists `meta/wiki-digest.md` — the agent's entry point for understanding current wiki state without scanning raw PARA.

## Entry Points

- `extensions/brain-wiki/src/digest.ts` → `buildDigest()`, `rebuildDigest()`

## Key Files

- `extensions/brain-wiki/src/digest.ts` → digest generation logic

## Constraints

- Digest reads existing generated artifacts only — no filesystem scanning of PARA
- Rebuilds only when `dirtyRoots` is set (on-change, not per-turn)
- "Below minimum" heuristic: word count < 100

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/digest.ts` | `buildDigest()`: reads registry, events, computes stats, stale items, below-minimum topics |
| Consumer | `extensions/brain-wiki/index.ts` | `rebuildAllGeneratedArtifacts()` calls `rebuildDigest()` after registry rebuild |
