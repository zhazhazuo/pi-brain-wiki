# Module: frontmatter

## Responsibility

Parses YAML frontmatter from markdown files, renders template strings with variable substitution, and serializes markdown pages with frontmatter and body.

## Entry Points

- extensions/brain-wiki/src/frontmatter.ts → parsePage(), renderTemplate(), readTemplate(), writePage(), setPageProperty()

## Key Files

- extensions/brain-wiki/src/frontmatter.ts → frontmatter parsing/rendering and page serialization entry points
- extensions/brain-wiki/src/obsidian-io.ts → Obsidian CLI-backed page/property write boundary

## Constraints

- Uses gray-matter library for YAML frontmatter parsing
- Templates use {{variable}} syntax, rendered via simple string replacement
- writePage() serializes frontmatter as YAML; with an Obsidian client it writes through the CLI boundary
- setPageProperty() uses Obsidian property:set when a client is provided and does not silently fall back on CLI errors

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/frontmatter.ts | parsePage(): extracts frontmatter and body; renderTemplate(): replaces {{var}} placeholders; writePage(): serializes YAML + body |
| Implementation | extensions/brain-wiki/src/obsidian-io.ts | writeMarkdownPage(): writes serialized markdown through Obsidian create; setMarkdownProperty(): delegates to property:set |
| Consumer | extensions/brain-wiki/src/scaffold.ts | readTemplate() + renderTemplate() for page creation; writePage() for writing canonical pages |
| Consumer | extensions/brain-wiki/src/capture.ts | writePage() for writing summary pages |
| Consumer | extensions/brain-wiki/src/indexer.ts | parseFrontmatter() for extracting metadata during registry building |
