# Recall Protocol

## Phase 1: Identify the source

Walker provides either:
- A wiki summary or topic page path
- A PKB entry path (find the wiki entries that informed it)
- A topic area (find all entries in that area awaiting Recall)

If Walker provides a PKB path, use `wiki_search` to find the wiki entries that relate to it.

If Walker provides a topic area, look at `wiki_scan_activity` for lifecycle backlog data to find integrated entries awaiting Recall.

## Phase 2: Read both sides

```
1. Read the wiki source(s) — the summary page and any topic pages it informed
2. Read the PKB entry at the pkb_refs path(s)
   - If the path doesn't exist, search the vault for similar filenames using the `bash` tool
   - If still not found, flag this: "PKB entry not found. Walker may need to create it."
```

## Phase 3: Compare and produce a gap list

Read the wiki source carefully. For each significant claim, fact, or concept:

1. **Covered:** The PKB entry already contains this information (or a close equivalent)
2. **Gap:** The wiki source says something the PKB doesn't cover
3. **Drift:** The PKB says something different from the wiki source
4. **Enhancement:** The wiki source has nuance or context that would enrich the PKB

Output format:

```markdown
## Comparison: [Source title] vs [PKB entry]

### Covered (no action needed)
- [Claim from wiki source — already in PKB]

### Gaps (PKB is missing this)
- [Claim from wiki source — not in PKB]

### Drift (PKB differs from wiki source)
- [Wiki says X, PKB says Y]

### Enhancements (PKB would benefit from adding)
- [Nuance or context from wiki source]
```

## Phase 4: Propose PKB edits

For each gap, drift, or enhancement:

1. Propose a specific edit to the PKB entry
2. Use the `edit` tool on the PKB file (Area/, etc.)
3. Wait for Walker to confirm each edit before applying
4. Never modify wiki pages in this phase — only the PKB

## Phase 5: Mark consumed

After Walker confirms that the knowledge is now in the PKB:

1. Use `wiki_log_event` with `kind: "consumed"`, `pagePaths: [<wiki-page-path>]`, and `notes: ["pkb:<pkb-path>"]` for each PKB entry that covers the source
2. Or use the `/wiki-consumed` command: `/wiki-consumed <page-path> <pkb-path>`

**This step is mandatory, not optional.** Every completed Recall session must end with marking the wiki page as consumed. If Walker declines to mark consumed, note it but don't skip the step — ask again.

## Phase 6: Log

Use `wiki_log_event` with `kind: "consumed"` to record the transition. The event should include:
- `title`: "Consumed [source title]"
- `pagePaths`: the wiki pages marked consumed
- `notes`: `pkb:` prefixed entries for each PKB path
- `actor`: "agent"
