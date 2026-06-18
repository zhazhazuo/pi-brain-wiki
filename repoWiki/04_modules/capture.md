# Module: capture

## Responsibility

Captures an external source (URL, file, text) as an immutable packet in inbox/ and scaffolds a summary page in pages/summaries/ with extracted content, PKB context, and frontmatter.

## Entry Points

- extensions/brain-wiki/src/capture.ts → main entry, exported captureSource()

## Key Files

- extensions/brain-wiki/src/capture.ts → all capture logic

## Constraints

- Inbox packets are immutable — never edited after creation
- Each capture creates a unique source ID (date-based)
- Supports three input types: url (fetched via curl/wget), file (copied), text (written directly)
- Extracted markdown, manifest JSON, and summary pages are written through Obsidian CLI when a client is provided
- Raw filesystem remains for original source acquisition/copying before the captured content is placed in the vault workflow
- The tool result returns the source summary page path so the agent can continue without shell discovery
- Summary pages seed `## PKB Context` blocks when graph context exists

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/capture.ts | captureSource(): validates input, downloads/copies original source, writes extracted/manifest content through Obsidian IO when available, scaffolds summary page, and returns sourcePagePath for immediate follow-up |
| Consumer | extensions/brain-wiki/src/obsidian-io.ts | Provides writeMarkdown() and writeMarkdownPage() for capture outputs |
| Consumer | extensions/brain-wiki/index.ts | wiki_capture_source tool handler calls captureSource() |
