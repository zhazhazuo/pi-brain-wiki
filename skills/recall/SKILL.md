---
name: recall
description: Compare wiki source knowledge against PKB entries to verify coverage, identify gaps, and mark knowledge as consumed. Use when Walker wants to verify that PKB entries fully cover a wiki source or topic.
---

# Recall — Knowledge Verification Skill

You are performing a **Recall session**: comparing wiki knowledge against Walker's PKB (Area/, Project/) to verify coverage and identify gaps.

## When to Use

- Walker says "I've internalized this" or "this is in my PKB now"
- Walker wants to compare a wiki source against existing PKB entries
- Walker wants to verify that knowledge has been fully transferred
- Walker asks to mark wiki pages as consumed

## Startup Checklist

Before any Recall session:

1. Load the `brain-wiki` skill (shared rules) — **required**
2. Read `Wiki/WIKI_SCHEMA.md` — conventions and structure
3. Read `Wiki/meta/index.md` — orient to current wiki state

## The Recall Protocol

### Phase 1: Identify the source

Walker provides either:
- A wiki summary or topic page path
- A PKB entry path (find the wiki entries that informed it)
- A topic area (find all entries in that area awaiting Recall)

If Walker provides a PKB path, use `wiki_search` to find the wiki entries that relate to it.

If Walker provides a topic area, look at `wiki_scan_activity` for lifecycle backlog data to find integrated entries awaiting Recall.

### Phase 2: Read both sides

```
1. Read the wiki source(s) — the summary page and any topic pages it informed
2. Read the PKB entry at the pkb_refs path(s)
   - If the path doesn't exist, search the vault for similar filenames using the `bash` tool
   - If still not found, flag this: "PKB entry not found. Walker may need to create it."
```

### Phase 3: Compare and produce a gap list

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

### Phase 4: Propose PKB edits

For each gap, drift, or enhancement:

1. Propose a specific edit to the PKB entry
2. Use the `edit` tool on the PKB file (Area/, etc.)
3. Wait for Walker to confirm each edit before applying
4. Never modify wiki pages in this phase — only the PKB

### Phase 5: Mark consumed

After Walker confirms that the knowledge is now in the PKB:

1. Use `wiki_log_event` with `kind: "consumed"`, `pagePaths: [<wiki-page-path>]`, and `notes: ["pkb:<pkb-path>"]` for each PKB entry that covers the source
2. Or use the `/wiki-consumed` command: `/wiki-consumed <page-path> <pkb-path>`

**This step is mandatory, not optional.** Every completed Recall session must end with marking the wiki page as consumed. If Walker declines to mark consumed, note it but don't skip the step — ask again.

### Phase 6: Log

Use `wiki_log_event` with `kind: "consumed"` to record the transition. The event should include:
- `title`: "Consumed [source title]"
- `pagePaths`: the wiki pages marked consumed
- `notes`: `pkb:` prefixed entries for each PKB path
- `actor`: "agent"

## Reactivation

If a wiki page is already `consumed` and a new source has been integrated into the same topic, the topic should be flipped back to `integrated`. This is handled by:

1. Workshop skill: when integrating a new source into a `consumed` topic, flip status back to `integrated` and log a `refactor` event noting the reactivation
2. Lint: `staleness` mode flags `consumed` topics with newly integrated inbound sources

## Clearing Archived Entries

When Walker asks about clearing archived entries:

1. Use `wiki_scan_activity` to get clearable candidates
2. Present each candidate with the reason (PKB-covered, no active links, superseded)
3. For each Walker confirms, use `wiki_log_event` with `kind: "cleared"` and `pagePaths`
4. The page frontmatter will be updated to `status: cleared` with `cleared_at` date

## Rules

1. **Never skip the comparison.** The value of Recall is the gap/drift list, not just the marking.
2. **Never modify wiki content during Recall.** You only modify PKB entries (with confirmation) and wiki status fields.
3. **The consumed marking is mandatory.** If you complete a Recall session and don't mark consumed, you've left the lifecycle incomplete.
4. **Respect PKB structure.** PKB entries are Walker's permanent knowledge. Propose edits carefully, don't restructure.
5. **Search before giving up.** If a PKB path doesn't resolve, search for the filename. PARA paths change.
