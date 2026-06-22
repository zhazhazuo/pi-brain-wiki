# Dev Guide

## Prerequisites

- Node.js >=20
- npm
- Bun (for extension unit tests)
- pi-coding-agent (peer dependency, installed in host project)

## Setup

1. Clone the repository:
   ```
   git clone https://github.com/walker/pi-brain-wiki.git
   cd pi-brain-wiki
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Dev server

No dev server — this is a pi extension package, not a web application. Testing is done via the host pi environment.

## Test commands

Package integrity:

```
npm run check
```

Runs `node --experimental-strip-types ./scripts/check.ts` which verifies:
- required files and `package.json` pi config
- every `skills/*/SKILL.md` loads via `loadSkills`
- extension `resources_discover` registers the package skills directory

Extension unit tests (Bun):

```
bun test extensions/brain-wiki/src/skills.test.ts
```

## Skills

### Layout

- `skills/<skill-name>/SKILL.md` — skill manifest (required)
- `skills/<skill-name>/instructions/` — optional protocol/rules loaded on demand

### Automatic discovery

The extension registers skills through `resources_discover`:

- `extensions/brain-wiki/src/skills.ts` → resolves `skills/` and exposes `getPackageSkillPaths()`
- `extensions/brain-wiki/index.ts` → returns the skills directory, not individual file paths
- Pi `loadSkills` recurses the directory and loads each subfolder's `SKILL.md`

### Add a new skill

1. Create `skills/my-skill/SKILL.md` with frontmatter:
   ```yaml
   ---
   name: my-skill
   description: What it does and when to load it.
   ---
   ```
2. Add optional `instructions/*.md` sub-files referenced from `SKILL.md`
3. Run `npm run check` — no edits to `index.ts` or `scripts/check.ts` required
4. Reload Pi so `resources_discover` picks up the new skill

### External context skill

- Skill name: `map-external-context`
- Path: `skills/map-external-context/`
- Routes PKB notes to linked local repos via `wiki_context_resolve` → `wiki_context_gather`
- Setup protocol: `skills/map-external-context/instructions/setup.md`
- Feature reference: `repoWiki/06_features/external-context.md`

## Env variables

None required for the package itself.

Vault external context uses machine-local `.wiki/env.local.json` (untracked, per laptop).

## Project structure

- `extensions/brain-wiki/index.ts` → pi extension entry point, tool registration, skill discovery hook
- `extensions/brain-wiki/src/` → domain modules
- `extensions/brain-wiki/src/skills.ts` → package skills directory resolution
- `skills/` → agent skills (auto-loaded)
- `scripts/check.ts` → pre-publish integrity checks
- `scripts/release.ts` → automated versioning and release
