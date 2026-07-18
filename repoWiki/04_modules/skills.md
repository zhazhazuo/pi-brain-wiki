# skills

## Responsibility

Resolves the package-level skills directory and discovers all `SKILL.md` files within it. Provides the skill file paths for automatic registration with the Pi agent runtime.

## Entry Points

- `extensions/brain-wiki/src/skills.ts` → `getPackageSkillsDir()` — absolute path to the skills directory
- `extensions/brain-wiki/src/skills.ts` → `listPackageSkillFiles()` — async discovery of all SKILL.md files

## Key Files

- `extensions/brain-wiki/src/skills.ts` → directory resolution, recursive SKILL.md discovery
- `extensions/brain-wiki/src/skills.test.ts` → unit tests for discovery

## Constraints

- Skills directory is resolved relative to the extension source file (`../../skills/`)
- Skips hidden directories (starting with `.`)
- Only includes directories that contain a `SKILL.md` file
- Results are sorted alphabetically
- Uses `import.meta.url` for ESM-compatible path resolution

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/skills.ts` | Package skills dir resolution, SKILL.md discovery |
| Consumer | `extensions/brain-wiki/index.ts` | Uses `getPackageSkillPaths()` for automatic skill registration |
