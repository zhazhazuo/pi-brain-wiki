# pi-brain-wiki - Runbook

<!-- metadata
generated: 2026-05-05
last_synced: 2026-05-08
-->

Agent-optimized knowledge base for pi-brain-wiki project.

---

## Quick Links

### Getting Started
- [Big Picture](./00_overview/big_picture.md) - What the system does
- [Tech Stack](./00_overview/tech_stack.md) - Dependencies and tools

### Navigation

**Maps** - Find files and understand structure
- [System Map](./01_maps/system_map.md) - Core layers and integrations
- [Feature Map](./01_maps/feature_map.md) - Features and entry points
- [Module Map](./01_maps/module_map.md) - Key modules

**Index** - File reference
- [File Index](./03_index/file_index.md) - Path to meaning

**Modules** - Deep dive
- [capture](./04_modules/capture.md) - Source capture and summary scaffolding
- [config](./04_modules/config.md) - Wiki configuration loading and defaults
- [paths](./04_modules/paths.md) - Root discovery and path resolution
- [scaffold](./04_modules/scaffold.md) - Vault bootstrap and page creation
- [frontmatter](./04_modules/frontmatter.md) - YAML frontmatter parsing and rendering
- [indexer](./04_modules/indexer.md) - Registry, backlinks, and index generation
- [lint](./04_modules/lint.md) - Structural health checks
- [search](./04_modules/search.md) - Registry search and ranking
- [log](./04_modules/log.md) - Event logging and history
- [activity](./04_modules/activity.md) - Vault activity scanning
- [guards](./04_modules/guards.md) - Protected path enforcement
- [slug](./04_modules/slug.md) - Slug and ID generation utilities
- [types](./04_modules/types.md) - Shared TypeScript type definitions
- [sync](./04_modules/sync.md) - PARA vault folder sync to wiki topics
- [triage](./04_modules/triage.md) - LIST.md routing center
- [project-sync](./04_modules/project-sync.md) - Project/ folder sync and task suggestions
- [task-sync](./04_modules/task-sync.md) - LIST.md ↔ Taskwarrior bidirectional sync
- [obsidian-io](./04_modules/obsidian-io.md) - Obsidian CLI-backed markdown/property IO boundary
- [obsidian-cli](./04_modules/obsidian-cli.md) - Obsidian CLI integration notes

### How-To

**Guides**
- [Development](./02_guides/dev.md) - Commands and environment
- [Debug](./02_guides/debug.md) - Common issues
- [Deploy](./02_guides/deploy.md) - Build and deploy

---

## Features

- [Future Mode Project Review](./06_features/future-mode-project-review.md)
- [Workflow Generation](./06_features/workflow-generation.md)
- [Taskwarrior Integration](./06_features/taskwarrior.md)

---

## Rules

1. Always locate feature before editing code
2. Prefer modifying existing modules over creating new ones
3. Keep API backward compatible unless explicitly required
4. Check module constraints in `./04_modules/*`

---

## Navigation Strategy (for agents)

1. Start from feature_map → identify feature
2. Go to module_map → locate module
3. Use file_index → find exact files
4. Follow guides → perform action
