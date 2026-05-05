# Module: capture

## Responsibility

Captures an external source (URL, file, text) as an immutable packet in inbox/ and scaffolds a summary page in pages/summaries/ with extracted content and frontmatter.

## Entry Points

- extensions/brain-wiki/src/capture.ts → main entry, exported captureSource()

## Key Files

- extensions/brain-wiki/src/capture.ts → all capture logic

## Constraints

- Inbox packets are immutable — never edited after creation
- Each capture creates a unique source ID (date-based)
- Supports three input types: url (fetched via curl/wget), file (copied), text (written directly)
- Summary page is scaffolded from the configured summary template

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/capture.ts | captureSource(): validates input, downloads/copies/writes packet, creates manifest.json, scaffolds summary page |
| Consumer | extensions/brain-wiki/index.ts | wiki_capture_source tool handler calls captureSource() |
