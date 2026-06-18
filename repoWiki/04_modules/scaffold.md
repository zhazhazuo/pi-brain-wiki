# Module: scaffold

## Responsibility

Bootstraps a new wiki vault: creates the directory structure (inbox, drafts, discussions, pages, meta, archive, .wiki/templates), writes default config, templates, schema, and initial metadata files. Also implements ensureCanonicalPage() for creating deduplicated topic/plan/review pages.

## Entry Points

- extensions/brain-wiki/src/scaffold.ts → bootstrapVault(), ensureCanonicalPage()

## Key Files

- extensions/brain-wiki/src/scaffold.ts → all scaffolding logic

## Constraints

- Creates `discussions/` and `drafts/` directories during bootstrap; seeds empty `discussions/route.md`
- `bootstrapVault()` refuses to run if .wiki/config.json already exists unless force=true
- Page creation deduplicates against the existing registry — prevents duplicate titles and aliases
- Canonical page creation writes through Obsidian CLI when a client is provided
- Templates are rendered with template variables (id, title, date, etc.)
- Default templates are embedded as constants in the file

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/scaffold.ts | bootstrapVault(): creates all directories (inbox, drafts, discussions, pages, meta, archive, templates), writes config, templates, schema, metadata files, empty route.md; ensureCanonicalPage(): finds or creates canonical pages with dedup and optional Obsidian CLI page write |
| Consumer | extensions/brain-wiki/index.ts | wiki_bootstrap tool handler calls bootstrapVault(); wiki_ensure_page tool handler calls ensureCanonicalPage() |
| Consumer | extensions/brain-wiki/src/frontmatter.ts | readTemplate() and renderTemplate() are used for page content generation |
| Consumer | extensions/brain-wiki/src/obsidian-io.ts | Writes canonical page markdown through Obsidian create when ensureCanonicalPage() receives a client |
| Consumer | extensions/brain-wiki/src/slug.ts | slugifyTitle() and dedupeSlug() used for page filename generation |
