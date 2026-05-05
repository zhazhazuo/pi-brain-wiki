# pi-brain-wiki

> Forked from [pi-llm-wiki](https://github.com/Kausik-A/pi-llm-wiki) by Kausik-A.
> Inspired by Andrej Karpathy's "LLM Wiki" gist.

A Pi-native implementation of the LLM Wiki pattern, adapted for personal knowledge management over a PARA + Johnny Decimal vault.

- **Pi extension** for deterministic operations, guardrails, and generated metadata
- **Three agent skills** (Map, Workshop, Intelligence) for wiki workflows
- A markdown vault structure (`Wiki/`) that accumulates knowledge over time

## Why this package exists

Most file-based LLM workflows behave like one-shot RAG. `pi-brain-wiki` creates a persistent comprehension layer — the `Wiki/` folder — where sources are captured, summarized, and interlinked. Three specialized agents maintain it:

- **Map agent** — queries what the wiki knows, progressive disclosure
- **Workshop agent** — supervised source ingest and integration
- **Intelligence agent** — activity analysis, plans, and reviews

## Page model

| Type | Purpose | Template sections |
|------|---------|-------------------|
| `summary` | Per-source distillation | Source at a glance, Executive summary, Main claims, Integration targets |
| `topic` | Knowledge map entry | Current understanding, Connections, Open questions |
| `plan` | Orientation | Priorities, Timeboxed blocks, Dependencies |
| `review` | Attention analysis | Activity clusters, Neglected areas, Emerging patterns |

## Vault layout

```
Wiki/
├── SKILL.md                ← shared agent rules
├── WIKI_SCHEMA.md          ← vault conventions
├── inbox/                  ← source packets (guarded)
├── pages/
│   ├── summaries/
│   ├── topics/
│   ├── plans/
│   └── reviews/
├── meta/                   ← generated (guarded)
├── archive/                ← retired pages
└── .wiki/
    ├── config.json
    └── templates/
```

## Tools

| Tool | Description |
|------|-------------|
| `wiki_bootstrap` | Initialize the vault structure |
| `wiki_capture_source` | Capture a source into inbox + summary page |
| `wiki_search` | Search the generated wiki registry |
| `wiki_ensure_page` | Resolve or safely create pages |
| `wiki_lint` | Run deterministic health checks |
| `wiki_status` | Show counts, source states, recent activity |
| `wiki_log_event` | Append structured events |
| `wiki_rebuild_meta` | Force a full metadata rebuild |
| `wiki_scan_activity` | Scan vault for recent changes (Intelligence agent) |

## Local development

```bash
cd ~/projects/pi-brain-wiki
npm install
npm run check
pi -e ./extensions/llm-wiki/index.ts
```

## License

MIT
