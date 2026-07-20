# pi-brain-wiki

> Forked from [pi-llm-wiki](https://github.com/Kausik-A/pi-llm-wiki) by Kausik-A.
> Inspired by Andrej Karpathy's "LLM Wiki" gist.

A Pi-native implementation of the LLM Wiki pattern, adapted for personal knowledge management over a PARA + Johnny Decimal vault.

- **Pi extension** for deterministic operations, guardrails, and generated metadata
- **Agent skills** for map, workshop, intelligence, recall, and learned workflow routing
- **PARA integration** — Wiki as knowledge graph layer over your vault
- A markdown vault structure (`Wiki/`) that accumulates knowledge over time

## Why this package exists

Most file-based LLM workflows behave like one-shot RAG. `pi-brain-wiki` creates a persistent comprehension layer — the `Wiki/` folder — where sources are captured, summarized, and interlinked. Specialized agents maintain it:

- **Map agent** — queries what the wiki knows, progressive disclosure
- **Workshop agent** — supervised source ingest and integration
- **Intelligence agent** — activity analysis, plans, and reviews
- **Workflow Extract skill** — proposes reusable workflow specs from repeated patterns
- **Workflow Invoke skill** — routes user requests through learned workflow pages

## When to use each agent

| Scenario | Agent | Why this agent |
|----------|-------|----------------|
| "What do we know about X?" | **Map** | Progressive disclosure: search registry → topic summaries → deep dive only if needed |
| "Find sources about Y" | **Map** | Queries the compiled registry, surfaces summaries with citations |
| "Where did I read about Z?" | **Map** | `wiki_search` matches on title, aliases, summary text, headings, tags |
| "What topics are related to X?" | **Map** | Reads topic page → follows wikilinks → surfaces connected knowledge |
| "Is there conflicting info about X?" | **Map** | Surfaces contradictions across summaries and topics, cites both sides |
| "I found this article/video/paper" | **Workshop** | `wiki_capture_source` → inbox packet + summary stub → Phase 3 builds a platform connecting it to your PKB → supervised integration |
| "Integrate this into the wiki" | **Workshop** | Absorption loop: orient → understand & connect (PKB search) → discuss takeaways → get confirmation → write |
| "This topic page is thin, enrich it" | **Workshop** | Reads existing summaries that informed it → identifies gaps → proposes edits → confirms with Walker |
| "Create a new topic page for X" | **Workshop** | Concrete noun test → `wiki_ensure_page` → write with substance → anti-thinning |
| "Two sources disagree, reconcile" | **Workshop** | Flags both claims as `contested`, surfaces to Walker, waits for input |
| "Refine this topic without new source" | **Workshop** | Re-read topic + its source pages → identify what's missing → propose improvements |
| "What was I focused on this week?" | **Intelligence** | `wiki_scan_activity` → synthesizes activity clusters, not file lists |
| "What should I work on next?" | **Intelligence** | Reads activity + LIST.md + Project/ frontmatter → prioritized, timeboxed plan |
| "Give me a weekly/monthly review" | **Intelligence** | Period review: compares activity vs. stated priorities, flags neglected areas |
| "What's been neglected?" | **Intelligence** | Scans for stale `last_action` in Project/ frontmatter, empty wiki topics, dormant Draft/ pages |
| "Are there knowledge gaps I should fill?" | **Intelligence** | Cross-references wiki topic coverage with Area/ and Resource/ → suggests workshop sessions |

**Decision rule of thumb:**

| You want to… | Use… |
|---|---|
| **Read** from the wiki | Map |
| **Write** to the wiki (with Walker supervising) | Workshop |
| **Reflect** on activity and plan ahead | Intelligence |

**PKB mini-search** — all three agents can full-text search the user's PKB (`Area/`, `Resource/`, `Draft/`, `Project/`, `LIST.md`) via the external `context-mode` MCP server, per a shared convention in `brain-wiki/instructions/mini-search.md`. It is mandatory for the Workshop's Phase 3 (Understand & Connect) and recommended for Map deep dives and Intelligence coverage-gap analysis. Read-only; degrades gracefully when `context-mode` is absent.

**Handoff pattern:**

```
Map finds a gap       → "This could benefit from a workshop session."
Intelligence finds gap → "A workshop session on X is recommended."
Workshop finishes      → Logs event, topics updated, Map can query them next time.
```

## Page model

| Type | Purpose | Template sections |
|------|---------|-------------------|
| `summary` | Per-source distillation | Source at a glance, Executive summary, Main claims, Integration targets |
| `topic` | Knowledge map entry | Current understanding, Connections, Open questions |
| `plan` | Orientation | Priorities, Timeboxed blocks, Dependencies |
| `review` | Attention analysis | Activity clusters, Neglected areas, Emerging patterns |
| `workflow` | Reusable agent procedure | Standard workflow YAML, Notes |

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
│   ├── reviews/
│   └── workflows/
├── meta/                   ← generated (guarded)
│   └── workflows.md        ← short route page for active/draft workflows
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
| `wiki_lint` | Run deterministic health checks, including page-type conformance rules |
| `wiki_status` | Show counts, source states, recent activity |
| `wiki_log_event` | Append structured events |
| `wiki_rebuild_meta` | Force a full metadata rebuild |
| `wiki_scan_activity` | Scan vault for recent changes (Intelligence agent) |
| `wiki_sync` | Scan PARA vault structure, update wiki topic pages |
| `wiki_triage` | Read, add, suggest, or flag stale items in LIST.md |
| `wiki_project_sync` | Scan projects, create projects, mutate state via validated commands, add notes, suggest tasks |
| `wiki_generate_workflow` | Create a standardized workflow page from approved structured inputs |

## Deterministic Project Process

Each project lives in `Project/<week-slug>/` with:

- `project.md` for canonical current state
- `tasks.md` for the local task queue
- `timeline.md` for append-only history
- `notes.md` for linked working notes

Agents must mutate this state through `wiki_project_sync` commands rather than direct edits. Supported mutation actions include `set_status`, `set_next_action`, `task_add`, `task_update`, and `timeline_append`.

## PARA Integration

The wiki acts as a knowledge graph layer over your PARA vault. The write gate enforces zone-based permissions:

| Zone | Path | Agent | Human |
|------|------|-------|-------|
| **Human-only** | `Area/` | Read only | Full control |
| **Agent-writable** | `Resource/`, `Draft/` | Can create/edit | Full control |
| **Shared** | `LIST.md`, `Project/` | Can read/write | Full control |
| **Wiki (agent-owned)** | `Wiki/` | Full control | Read/browse |

**Key rules:**
- `Area/` is sacred — agent never modifies it
- All AI content in LIST.md uses `> 🤖 [AI]` prefix
- Obsidian CLI used for all supported operations

## Local development

```bash
cd ~/projects/pi-brain-wiki
npm install
npm run check
pi -e ./extensions/brain-wiki/index.ts
```

## License

MIT
