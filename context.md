FILE_INDEX:
pi-brain-wiki/
  .gitignore → Ignores node_modules, npm-debug.logs, .DS_Store, and .tgz archives
  .github/workflows/ci.yml → GitHub Actions CI workflow: runs `npm run check` on push/PR
  .github/workflows/release.yml → GitHub Actions release workflow: publishes to npm on version tags
  CHANGELOG.md → Version history and changelog (Keep a Changelog format)
  LICENSE → MIT license text
  README.md → Project overview: page model, vault layout, tool reference, and architecture
  RELEASING.md → Release instructions: versioning, changelog, local scripts, npm publish
  docs/00_overview/big_picture.md → High-level system overview: core flow, constraints, available tools
  docs/00_overview/tech_stack.md → Technology stack: Node.js >=20, ESM TypeScript, filesystem storage, gray-matter
  docs/01_maps/feature_map.md → Maps each feature to its source file with one-line description
  docs/01_maps/module_map.md → Mermaid dependency diagram showing how extension modules connect
  docs/01_maps/system_map.md → Architecture layers diagram: pi agent → tools → domain modules → filesystem
  extensions/brain-wiki/index.ts → Main pi extension entry point: registers tools, lifecycle hooks, and tool definitions
  skills/brain-wiki/SKILL.md → Agent skill: wiki maintenance rules and non-negotiable constraints
  extensions/brain-wiki/src/activity.ts → Scans vault for recent changes across wiki and PARA folders
  extensions/brain-wiki/src/capture.ts → Captures URL/file/text as immutable source packet and scaffolds summary page
  extensions/brain-wiki/src/config.ts → Loads, creates, and writes .wiki/config.json with defaults
  extensions/brain-wiki/src/frontmatter.ts → Parses/writes YAML frontmatter and extracts wiki links and headings
  extensions/brain-wiki/src/guards.ts → Analyzes tool mutations to protect inbox/ and meta/ paths from edits
  extensions/brain-wiki/src/indexer.ts → Builds and persists registry.json, backlinks.json, and index.md
  extensions/brain-wiki/src/lint.ts → Runs structural health checks: links, orphans, frontmatter, duplicates, coverage, staleness
  extensions/brain-wiki/src/log.ts → Appends structured events to events.jsonl and regenerates log.md
  extensions/brain-wiki/src/paths.ts → Resolves wiki root from cwd, computes all vault paths and relative references
  extensions/brain-wiki/src/scaffold.ts → Bootstraps vault directory structure, templates, and metadata files
  extensions/brain-wiki/src/search.ts → Queries the compiled page registry with scoring and ranking
  extensions/brain-wiki/src/slug.ts → Slugifies titles, generates source/page IDs, deduplicates slugs
  extensions/brain-wiki/src/types.ts → Shared TypeScript interfaces and type definitions (WikiConfig, ParsedPage, etc.)
  package-lock.json → npm lockfile for reproducible dependency resolution
  package.json → Package metadata, pi extension registration, scripts, and dependencies (gray-matter)
  scripts/check.ts → Pre-publish integrity checks: verifies required files and package.json config
  scripts/release.ts → Automates npm version bump, changelog update, git tag, and commit
  tsconfig.json → TypeScript configuration: ES2022 target, NodeNext module resolution, noEmit
