# Search → Orient → Dive

```
Question received
    │
    ▼
Search wiki (wiki_search)
    │
    ├── Found matching topics?
    │       │
    │       ▼
    │   Read topic summaries (5-20 lines each)
    │       │
    │       │   If a topic is `consumed`, follow its `pkb_refs` to the PKB entry
    │       │   instead of reading the wiki page. The PKB is the source of truth
    │       │   for consumed knowledge. If the PKB entry is missing, flag it:
    │       │   "Topic marked consumed but PKB entry not found at [path]."
    │       │
    │       ├── Enough depth for the question?
    │       │       │
    │       │       ▼
    │       │   Synthesize answer with citations
    │       │
    │       └── Need more depth?
    │               │
    │               ▼
    │           Follow wikilinks into Area/ pages (PKB depth)
    │           Read only the relevant sections
    │           Synthesize answer with citations
    │
    └── No matching topics?
            │
            ▼
        Search Area/ JD shelves directly (PKB)
        Read relevant pages
        Synthesize answer, note that no wiki topic exists yet
        Suggest creating a topic page if the question is substantive
```

## Progressive Disclosure in Action

When answering "What do we know about X?":

**Level 1 — Index scan:**
```
wiki_search("X") → find relevant topics
```

**Level 2 — Topic summaries:**
```
Read each matching topic page (5-20 lines each)
Synthesize what the wiki believes about X
```

**Level 3 — Deep dive (only if needed):**
```
Follow wikilinks from topics into Area/ pages (PKB depth)
Read specific sections cited by the topics
Add Area/ depth to the synthesis
```

**PKB mini-search option (recommended for long Area/ pages):** instead of reading a whole Area/ page, load `brain-wiki/instructions/mini-search.md`, index `pkb-area` per its recipe (hard gate — `ctx_search` over an un-indexed scope returns "No results found" for terms that exist), and run `ctx_search` with `source: "pkb-area"` and the question's terms. You get only the matched windows, not the full page bytes — cheaper and often sufficient for lexical questions. Fall back to a full `read` only when the match is ambiguous. Never omit `source` — context-mode's store is shared with web fetches and session memory.

Always return the most useful answer at the shallowest level. If the topic summary answers the question, stop. Don't read Area/ or Resource/ just because you can. When Area/ depth is needed and the page is long, prefer `ctx_search` over `pkb-area` (see mini-search option above) before reading the full file.

## Cross-referencing LIST.md

Before answering, check if LIST.md contains items relevant to the question:
- A source URL about the topic that hasn't been captured → "There's a blog link in LIST.md about this. Want me to capture it first?"
- An idea or note that relates → "There's a relevant note in LIST.md from May 3: [excerpt]"
- Don't just answer from wiki state — LIST.md is the live edge of what Walker is thinking about
