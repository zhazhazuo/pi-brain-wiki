# Tech Stack

## runtime
- Node.js → >=20, ESM
- TypeScript → ES2022, NodeNext module resolution
- tsconfig → strict false, noEmit, skipLibCheck

## frontend
- none

## backend
- none (extension is filesystem-bound, no HTTP layer)

## storage
- local filesystem → markdown files (pages), JSON (metadata, registry, backlinks, events), raw packets (inbox/)
- gray-matter → frontmatter parsing for markdown pages

## infra
- npm registry → published as pi-brain-wiki (public access)
- pi-coding-agent → extension runtime (peer dependency @mariozechner/pi-coding-agent, @mariozechner/pi-ai, @sinclair/typebox)
