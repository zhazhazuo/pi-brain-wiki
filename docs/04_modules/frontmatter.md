# Module: frontmatter

## Responsibility

Parses YAML frontmatter from markdown files, renders template strings with variable substitution, and writes markdown pages with frontmatter and body.

## Entry Points

- extensions/brain-wiki/src/frontmatter.ts → parseFrontmatter(), renderTemplate(), readTemplate(), writePage()

## Key Files

- extensions/brain-wiki/src/frontmatter.ts → all frontmatter parsing and rendering logic

## Constraints

- Uses gray-matter library for YAML frontmatter parsing
- Templates use {{variable}} syntax, rendered via simple string replacement
- writePage() serializes frontmatter as YAML and writes the complete file

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/frontmatter.ts | parseFrontmatter(): extracts frontmatter and body; renderTemplate(): replaces {{var}} placeholders; writePage(): writes YAML + body to file |
| Consumer | extensions/brain-wiki/src/scaffold.ts | readTemplate() + renderTemplate() for page creation; writePage() for writing canonical pages |
| Consumer | extensions/brain-wiki/src/capture.ts | writePage() for writing summary pages |
| Consumer | extensions/brain-wiki/src/indexer.ts | parseFrontmatter() for extracting metadata during registry building |
