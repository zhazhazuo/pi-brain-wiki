# Graduation Mode — wiki → PKB

Graduation is the second half of the learning loop. Ingest brought knowledge into the wiki and recorded its **edges** — the questions at Walker's knowledge boundary. Graduation verifies that Walker's PKB (Area/, Project/) has absorbed the knowledge, **closes the edges the PKB now answers**, and marks the wiki page consumed.

The central question is not "does the PKB cover this source?" but **"which of this page's edges has Walker's PKB closed?"** The gap list is a learning signal, not bookkeeping.

## Phase 1: Identify the source

Walker provides either:
- A wiki summary or topic page path
- A PKB entry path (find the wiki entries that informed it)
- A topic area (find all entries in that area awaiting graduation)

If Walker provides a PKB path, use `wiki_search` to find the wiki entries that relate to it.

If Walker provides a topic area, look at `wiki_scan_activity` for lifecycle backlog data (`integratedAwaitingRecall`) and at `meta/edges.md` for pages carrying open edges.

## Phase 2: Read both sides

```
1. Read the wiki source(s) — the summary page (including its ## Bridge section and
   frontmatter edges) and any topic pages it informed
2. Read the PKB entry at the pkb_refs path(s)
   - If the path doesn't exist, search the vault for similar filenames using the `bash` tool
   - If still not found, flag this: "PKB entry not found. Walker may need to create it."
```

## Phase 3: Compare against the edges

Start from the page's frontmatter `edges:`. For each open or exploring edge:

1. **Closed:** the PKB entry now answers this edge → propose `state: resolved` with `resolved_at` and `pkb_ref`
2. **Partially closed:** the PKB touches it but the tension remains → keep `state: exploring`, note what's missing
3. **Untouched:** the PKB says nothing about it → this is a gap Walker has not internalized

Then compare the remaining content. For each significant claim, fact, or concept:

1. **Covered:** The PKB entry already contains this information (or a close equivalent)
2. **Gap:** The wiki source says something the PKB doesn't cover
3. **Drift:** The PKB says something different from the wiki source — **surface this prominently**: Walker's understanding may have changed since the PKB entry was written. This is a high-value learning event, not a text diff.
4. **Enhancement:** The wiki source has nuance or context that would enrich the PKB

Output format:

```markdown
## Graduation: [Source title] vs [PKB entry]

### Edges
- [edge-1] CLOSED — PKB answers this at [[Area/...]]
- [edge-2] UNTOUCHED — not in PKB; Walker hasn't internalized this yet

### Covered (no action needed)
- [Claim from wiki source — already in PKB]

### Gaps (PKB is missing this)
- [Claim from wiki source — not in PKB]

### Drift (PKB differs from wiki source — understanding may have changed)
- [Wiki says X, PKB says Y — discuss with Walker before touching either side]

### Enhancements (PKB would benefit from adding)
- [Nuance or context from wiki source]
```

## Phase 4: Propose PKB edits

For each gap, drift, or enhancement:

1. Propose a specific edit to the PKB entry
2. Use the `edit` tool on the PKB file (Area/, etc.)
3. Wait for Walker to confirm each edit before applying
4. Never modify wiki page content in this phase — only edge state transitions and status fields

## Phase 5: Close resolved edges

For each edge the PKB now answers, update the summary page frontmatter:

```yaml
edges:
  - id: edge-1
    text: ...
    state: resolved
    resolved_at: YYYY-MM-DD
    pkb_ref: "Area/1 CS/17 AI/LLM Memory.md"
```

Do not resolve edges Walker has not actually internalized — an open edge is an honest frontier.

## Phase 6: Mark consumed

After Walker confirms that the knowledge is now in the PKB:

1. Use `wiki_log_event` with `kind: "consumed"`, `pagePaths: [<wiki-page-path>]`, and `notes: ["pkb:<pkb-path>"]` for each PKB entry that covers the source
2. Or use the `/wiki-consumed` command: `/wiki-consumed <page-path> <pkb-path>`

**This step is mandatory, not optional.** Every completed graduation session must end with marking the wiki page as consumed. If Walker declines to mark consumed, note it but don't skip the step — ask again.

## Phase 7: Log

Use `wiki_log_event` with `kind: "consumed"` to record the transition. The event should include:
- `title`: "Consumed [source title]"
- `pagePaths`: the wiki pages marked consumed
- `notes`: `pkb:` prefixed entries for each PKB path, plus `edges-resolved:N` when edges were closed
- `actor`: "agent"

## Clearing Archived Entries

When Walker asks about clearing archived entries:

1. Use `wiki_scan_activity` to get clearable candidates
2. Present each candidate with the reason (PKB-covered, no active links, superseded)
3. For each Walker confirms, use `wiki_log_event` with `kind: "cleared"` and `pagePaths`
4. The page frontmatter will be updated to `status: cleared` with `cleared_at` date
