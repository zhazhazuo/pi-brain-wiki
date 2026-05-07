# Feature Map

- capture → extensions/brain-wiki/src/capture.ts — capture URL/file/text as immutable source packet and scaffold summary page
- config → extensions/brain-wiki/src/config.ts — load, create, and write .wiki/config.json with defaults
- paths → extensions/brain-wiki/src/paths.ts — resolve wiki root from cwd, compute all vault paths
- scaffold → extensions/brain-wiki/src/scaffold.ts — bootstrap vault directory structure, templates, and metadata files
- frontmatter → extensions/brain-wiki/src/frontmatter.ts — parse, render, and write YAML frontmatter for markdown pages
- indexer → extensions/brain-wiki/src/indexer.ts — build and persist registry.json, backlinks.json, and index.md
- lint → extensions/brain-wiki/src/lint.ts — run structural checks (links, orphans, frontmatter, duplicates, coverage, staleness)
- search → extensions/brain-wiki/src/search.ts — query the compiled page registry
- log → extensions/brain-wiki/src/log.ts — append structured events to events.jsonl and regenerate log.md
- activity → extensions/brain-wiki/src/activity.ts — scan vault and wiki activity for a time period; parses LIST.md into typed items with category detection and agent notes
- guards → extensions/brain-wiki/src/guards.ts — analyze tool mutations to protect inbox/ and meta/ paths
- slug → extensions/brain-wiki/src/slug.ts — slugify titles, generate page IDs, dedupe slugs
- types → extensions/brain-wiki/src/types.ts — shared TypeScript interfaces and types
- obsidian-client → extensions/brain-wiki/src/obsidian-client.ts **(proposed)** — Unix socket client for the Obsidian CLI
- obsidian-fs → extensions/brain-wiki/src/obsidian-fs.ts **(proposed)** — file operations via obsidian create/move/rename/delete
- properties → extensions/brain-wiki/src/properties.ts **(proposed)** — lifecycle state management via obsidian property:*
