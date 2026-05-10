# File Index

## Root

- package.json → Package metadata, pi extension registration, scripts, dependencies (gray-matter)
- package-lock.json → npm lockfile for reproducible dependency resolution
- tsconfig.json → TypeScript configuration: ES2022 target, NodeNext module resolution, noEmit
- CHANGELOG.md → Version history and changelog (Keep a Changelog format)
- LICENSE → MIT license text
- README.md → Project overview: page model, vault layout, tool reference, and architecture
- RELEASING.md → Release instructions: versioning, changelog, local scripts, npm publish

## .github/workflows/

- .github/workflows/ci.yml → GitHub Actions CI workflow: runs npm run check on push/PR
- .github/workflows/release.yml → GitHub Actions release workflow: publishes to npm on version tags

## extensions/brain-wiki/

- extensions/brain-wiki/index.ts → Main pi extension entry point: registers tools, lifecycle hooks, and tool definitions
- extensions/brain-wiki/resources/skills/brain-wiki/SKILL.md → Agent skill: wiki maintenance rules and non-negotiable constraints
- extensions/brain-wiki/resources/skills/recall/SKILL.md → Agent skill: compare wiki sources against PKB entries
- extensions/brain-wiki/resources/skills/wiki-intel/SKILL.md → Agent skill: synthesize wiki activity patterns and periodic review
- extensions/brain-wiki/resources/skills/wiki-map/SKILL.md → Agent skill: orient to current wiki knowledge state
- extensions/brain-wiki/resources/skills/wiki-workshop/SKILL.md → Agent skill: ingest sources and refine wiki topics

## extensions/brain-wiki/src/

- extensions/brain-wiki/src/activity.ts → Scans vault for recent changes across wiki and PARA folders; parses LIST.md into typed items
- extensions/brain-wiki/src/capture.ts → Captures URL/file/text as immutable source packet and scaffolds summary page
- extensions/brain-wiki/src/config.ts → Loads, creates, and writes .wiki/config.json with defaults
- extensions/brain-wiki/src/digest.ts → Builds meta/wiki-digest.md: agent entry point with stats, events, stale items, below-minimum topics
- extensions/brain-wiki/src/frontmatter.ts → Parses/writes YAML frontmatter and extracts wiki links and headings
- extensions/brain-wiki/src/guards.ts → Analyzes tool mutations to protect inbox/ and meta/ paths from edits
- extensions/brain-wiki/src/indexer.ts → Builds and persists registry.json, backlinks.json, and index.md
- extensions/brain-wiki/src/lifecycle.ts → Hardcoded grace period constants for page lifecycle transitions
- extensions/brain-wiki/src/lint.ts → Runs structural health checks: links, orphans, frontmatter, duplicates, coverage, staleness, stale sync
- extensions/brain-wiki/src/log.ts → Appends structured events to events.jsonl and regenerates log.md
- extensions/brain-wiki/src/obsidian-client.ts → New: Unix socket client for the Obsidian CLI
- extensions/brain-wiki/src/obsidian-client.test.ts → Unit tests for ObsidianClient
- extensions/brain-wiki/src/obsidian-fs.ts → New: file operations via obsidian create/move/rename/delete
- extensions/brain-wiki/src/paths.ts → Resolves wiki root from cwd, computes all vault paths, resolves wikilinks to absolute paths
- extensions/brain-wiki/src/project-sync.ts → Scan/add notes/suggest tasks for Project/ folders
- extensions/brain-wiki/src/properties.ts → New: property helpers for wiki lifecycle via obsidian property:*
- extensions/brain-wiki/src/scaffold.ts → Bootstraps vault directory structure (incl. discussions/, drafts/), templates, and metadata files
- extensions/brain-wiki/src/search.ts → Queries the compiled page registry with scoring and ranking (planned: delegate to obsidian search:context)
- extensions/brain-wiki/src/search.test.ts → Unit tests for registry search
- extensions/brain-wiki/src/slug.ts → Slugifies titles, generates source/page IDs, deduplicates slugs
- extensions/brain-wiki/src/sync.ts → Bootstrap wiki topics from PARA folders; writes last_synced, para_source, sync-state.json
- extensions/brain-wiki/src/triage.ts → Read, add, suggest, flag stale items in LIST.md
- extensions/brain-wiki/src/types.ts → Shared TypeScript interfaces and type definitions

## scripts/

- scripts/check.ts → Pre-publish integrity checks: verifies required files and package.json config
- scripts/release.ts → Automates npm version bump, changelog update, git tag, and commit

## docs/

- docs/00_overview/big_picture.md → High-level system overview: core flow, constraints, available tools
- docs/00_overview/tech_stack.md → Technology stack: Node.js >=20, ESM TypeScript, filesystem storage, gray-matter
- docs/01_maps/feature_map.md → Maps each feature to its source file with one-line description
- docs/01_maps/module_map.md → Mermaid dependency diagram showing how extension modules connect
- docs/01_maps/system_map.md → Architecture layers diagram: pi agent → tools → domain modules → filesystem
