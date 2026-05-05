# Module: slug

## Responsibility

Provides string utilities for slugifying page titles (converting to URL-safe slugs), generating unique source and page IDs with date prefixes, and deduplicating slugs against existing page names.

## Entry Points

- extensions/brain-wiki/src/slug.ts → slugifyTitle(), makePageId(), makeSourceId(), dedupeSlug(), todayStamp()

## Key Files

- extensions/brain-wiki/src/slug.ts → all slug/ID logic

## Constraints

- Page IDs follow the pattern: type-slug-timestamp (e.g., topic-my-page-20260505)
- Source IDs follow the pattern: SRC-YYYY-MM-DD-NNN
- Slug deduplication appends a numeric suffix to avoid collisions

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/slug.ts | slugifyTitle(): lowercases, replaces spaces with hyphens, strips non-alphanumeric; makePageId()/makeSourceId(): generate prefixed IDs; dedupeSlug(): appends -2, -3, etc. |
| Consumer | extensions/brain-wiki/src/scaffold.ts | slugifyTitle() and dedupeSlug() for canonical page filename generation |
| Consumer | extensions/brain-wiki/src/capture.ts | makeSourceId() for source packet IDs |
