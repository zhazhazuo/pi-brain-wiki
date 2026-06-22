# External Context Protocol

Use when Walker wants repo-backed context for a specific note or system.

## Phase 1 — Identify the anchor

Walker provides one of:
- PKB note path or wikilink (preferred)
- Context id (e.g. `sales-tool-application`)
- System name → search PKB with `wiki_search` or `wiki_graph_find` first

Read the PKB note frontmatter. If `brain_wiki_context` is set, use that id.

## Phase 2 — Ensure configuration exists

Call `wiki_context_list` when you need the catalog, or `wiki_context_resolve` with `context_id` and/or `pkb_note`.

| Result | Action |
|--------|--------|
| Success | Continue to Phase 3 |
| Unknown context | Run `instructions/setup.md`; stop until configured |
| Missing env mapping | Add `repo_key` to `.wiki/env.local.json`; re-resolve |
| Path does not exist | Ask Walker for correct local path on this machine |

## Phase 3 — Select intent

Map Walker's request to one allowed intent from the resolved descriptor:

| Walker says | Intent |
|-------------|--------|
| "What is this repo?" / "Give me an overview" | `overview` |
| "How is it structured?" / "Architecture" | `architecture` |
| "Where is X implemented?" / "Find the code for..." | `implementation` + `query` |
| "What changed recently?" | `recent_changes` |
| Concrete single question about the codebase | `question` + `query` |
| "Handoff" / "Brief for next session" | `handoff` |

If intent is not in `allowed_intents`, ask Walker whether to expand the registry entry.

Reject vague `question` prompts ("look around and tell me stuff") — ask for a concrete query.

## Phase 4 — Gather

```
wiki_context_gather({
  context_id: "<resolved-context-id>",
  intent: "<intent>",
  query: "<concrete string when required>",
  limit_commits: <optional number for recent_changes / handoff>
})
```

`wiki_context_gather` runs an isolated Pi agent inside the target repository. The repo agent follows that repository's `AGENTS.md` and local skills, then returns a brief with Summary, Evidence, Limits, and Suggested follow-ups.

Do not run gather if resolve failed. Do not bypass gather by reading the external repository from the parent wiki session.

## Phase 5 — Weave results

Present findings using this structure:

```markdown
## External context: [label]

**Intent:** [intent]
**Repo:** [context_id] (path validated locally; do not paste absolute path into PKB)

### Summary
- [bullets from gather summary]

### Evidence
- [file/search/commit evidence — cite paths relative to repo root]

### Limits
- [limits_hit if any, plus follow_up_suggestions]

### PKB / wiki implications
- [how this relates to the anchor note — gaps, confirmations, next inspection targets]
```

**PKB/wiki-only follow-up:** offer to update wiki topic pages or propose PKB edits — never paste large code blocks or machine paths into synced notes.

## Phase 6 — Log (when substantive)

After a non-trivial gather session:

```
wiki_log_event({
  kind: "query",
  title: "External context gather: [label] / [intent]",
  notes: ["context:<context-id>", "intent:<intent>"]
})
```
