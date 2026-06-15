# Module Map

```mermaid
flowchart LR
  Index[extensions/brain-wiki/index.ts]
  Capture[src/capture.ts]
  Config[src/config.ts]
  Paths[src/paths.ts]
  Scaffold[src/scaffold.ts]
  Fm[src/frontmatter.ts]
  Indexer[src/indexer.ts]
  Lint[src/lint.ts]
  Search[src/search.ts]
  Log[src/log.ts]
  Activity[src/activity.ts]
  Guards[src/guards.ts]
  Slug[src/slug.ts]
  Types[src/types.ts]
  Digest[src/digest.ts]
  Lifecycle[src/lifecycle.ts]
  Sync[src/sync.ts]
  Triage[src/triage.ts]
  ProjectSync[src/project-sync.ts]
  Graph[src/graph.ts]
  ObsidianIo[src/obsidian-io.ts]

  Index --> Capture
  Index --> Config
  Index --> Paths
  Index --> Scaffold
  Index --> Fm
  Index --> Indexer
  Index --> Lint
  Index --> Search
  Index --> Log
  Index --> Activity
  Index --> Guards
  Index --> Slug
  Index --> Types
  Index --> Digest
  Index --> Lifecycle
  Index --> Sync
  Index --> Triage
  Index --> ProjectSync
  Index --> Graph
  Index -.-> ObsidianClient[src/obsidian-client.ts]
  Index --> ObsidianIo
  ObsidianIo --> ObsidianClient
  Index -.-> ObsidianFs[src/obsidian-fs.ts]
  Index -.-> Properties[src/properties.ts]
  Capture -.-> ObsidianClient
  Capture --> ObsidianIo
  Fm --> ObsidianIo
  Indexer -.-> ObsidianClient
  Lint -.-> ObsidianClient
  Search -.-> ObsidianClient
  Scaffold -.-> ObsidianFs
  Scaffold -.-> ObsidianClient
  Activity -.-> ObsidianClient
  Sync -.-> ObsidianClient
  Graph -.-> ObsidianClient

  classDef new stroke-dasharray: 5 5
  class ObsidianClient,ObsidianFs,Properties new
```

| Module | Entry file | Status |
|--------|-----------|--------|
| Extension entry | extensions/brain-wiki/index.ts | current |
| capture | extensions/brain-wiki/src/capture.ts | current |
| config | extensions/brain-wiki/src/config.ts | current |
| paths | extensions/brain-wiki/src/paths.ts | current |
| scaffold | extensions/brain-wiki/src/scaffold.ts | current |
| frontmatter | extensions/brain-wiki/src/frontmatter.ts | current |
| indexer | extensions/brain-wiki/src/indexer.ts | current |
| lint | extensions/brain-wiki/src/lint.ts | current |
| search | extensions/brain-wiki/src/search.ts | current |
| log | extensions/brain-wiki/src/log.ts | current |
| activity | extensions/brain-wiki/src/activity.ts | current |
| guards | extensions/brain-wiki/src/guards.ts | current |
| slug | extensions/brain-wiki/src/slug.ts | current |
| types | extensions/brain-wiki/src/types.ts | current |
| digest | extensions/brain-wiki/src/digest.ts | current |
| lifecycle | extensions/brain-wiki/src/lifecycle.ts | current |
| sync | extensions/brain-wiki/src/sync.ts | current |
| triage | extensions/brain-wiki/src/triage.ts | current |
| project-sync | extensions/brain-wiki/src/project-sync.ts | current |
| graph | extensions/brain-wiki/src/graph.ts | current |
| obsidian-client | extensions/brain-wiki/src/obsidian-client.ts | current |
| obsidian-io | extensions/brain-wiki/src/obsidian-io.ts | current |
| obsidian-fs | extensions/brain-wiki/src/obsidian-fs.ts | **proposed** |
| properties | extensions/brain-wiki/src/properties.ts | **proposed** |
