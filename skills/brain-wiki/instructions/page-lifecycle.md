# Page Lifecycle

```
captured → integrated → consumed → archived → cleared
               ↑            │
               └────────────┘  (reactivation on new source)
```

| Status | Meaning | When Applied |
|--------|---------|-------------|
| `captured` | Source ingested but not integrated into topics | Auto-set on capture |
| `integrated` | Content woven into wiki; page is authoritative | Set after integration complete |
| `consumed` | Walker has internalized this; PKB is the source of truth | Set via workshop graduation mode or `/wiki-consumed` command |
| `draft` | Topic page exists but not yet authoritative | Set on topic creation |
| `contested` | Two sources openly disagree; resolution pending | Set when contradiction flagged |
| `superseded` | Newer source has replaced this page's claims | Old page kept for provenance |
| `archived` | Retired; excluded from search and lint by default | Set when knowledge is fully in PKB and no longer needed in wiki |
| `cleared` | Removed from wiki; preserved during grace period | Set by Workshop/Intelligence when archiving clears old entries |

## Reactivation

When a new source is integrated into a `consumed` topic, flip the topic back to `integrated`. Consumed is a checkpoint, not a destination.

## Superseded Sources

Superseded sources are never deleted. They preserve the evolution of understanding. The newer page links back: "Supersedes `[[summaries/old-summary]]`."
