# Rules

## 1. Absorption loop is mandatory

Before editing any page, re-read it. Before starting any session, re-read the index. Never edit blind.

If you can't re-read (page doesn't exist yet), that's fine — you're creating. But if the page exists and you're updating it, read it first.

## 2. The platform is mandatory — and it persists

Every ingest runs Phase 3 (Understand & Connect) before Phase 4 (Discuss) and Phase 5 (Write). The platform teaches the new content at concept level and connects it to what Walker already knows via PKB search (`brain-wiki/instructions/mini-search.md`). Skipping Phase 3 reverts the workshop to filing.

Depth scales with source weight (Trivial / Substantial / Heavy — see `protocol.md` and `platform.md`), but presence never scales to zero. Even a trivial source gets a one-line platform.

The platform is persisted: it becomes the `## Bridge` section of the summary page, and each identified edge becomes a frontmatter `edges:` entry. `wiki_integrate_source` refuses to integrate a summary page without `edges:` frontmatter, a `## Bridge` section, and concrete integration targets. Filing without understanding is a tool-level error, not a style issue.

## 3. Integration Targets on every summary

Every summary page MUST have an `## Integration targets` section listing which topic pages this source should affect:

```markdown
## Integration targets
- [[topics/functional-programming]] — adds historical context on early FP languages
- [[topics/lambda-calculus]] — confirms existing timeline
- [[topics/type-theory]] — new perspective on dependent types
```

This is the bridge between "what this source says" and "what it means for our knowledge."

## 4. Concrete noun test before new pages

Before creating any topic page, ask: **"X is a ___"**

- Named person/org/event with substance → create page
- Generic technology with passing mention → don't create
- Can't write 3+ meaningful sentences → don't create

When in doubt, add information to an existing topic rather than creating a thin new one.

## 5. Anti-cramming

If you're about to add a third paragraph about a sub-topic to an existing topic page, that sub-topic probably deserves its own page. Create it.

## 6. Anti-thinning

Every edit must make the page meaningfully richer. A stub with 3 vague sentences is a failure. If you create a page, give it substance immediately.

## 7. One-way links to PARA

Wiki pages link into Area/ (PKB) or Resource/ (external) with context annotations:

```markdown
[[Area/1 CS/17 AI/LLM Memory]] — PKB entry covering the technical background.
[[Resource/type-theory-paper.pdf]] — external reference on dependent types.
See [[Project/Widget Launch]] (status: active, deadline May 15).
```

Never the reverse. Never modify PARA files.

## 8. Writing standards apply

Follow all rules from `brain-wiki` skill:
- Encyclopedic tone, no editorial voice
- Max 2 direct quotes per page
- One claim per sentence, short sentences
- Attribution over assertion
- Length targets: summaries 20-40 lines, topics 5-20 lines

## 9. Status management

| Action | Status Change |
|--------|--------------|
| Capture source | summary → `captured` |
| Finish integrating | summary → `integrated` |
| Create new topic | topic → `draft` |
| Finish enriching topic (multiple sources) | topic → `integrated` |
| Find contradiction | both pages → `contested` (flag to Walker) |
| Newer source replaces older | older → `superseded`, link back |
| New source integrated into consumed topic | topic → `integrated` (reactivated), log `refactor` event noting reactivation |

## 10. Discuss contradictions, don't silently resolve

If you find that a source contradicts what the wiki currently says:

1. Flag both claims with `⚠️ Contradiction:` annotations
2. Surface to Walker: "This source says X, but [[summaries/older-source]] says Y."
3. Wait for Walker's input before reconciling
4. Never silently pick one side

## 11. Reactivation rule

When integrating a new source into a topic that is currently `consumed`:

1. Check the topic's status before editing
2. If the topic is `consumed`, flip its status back to `integrated`
3. Add a note to the frontmatter `updated` field with today's date
4. Log a `refactor` event: `wiki_log_event kind=refactor title="Reactivated [topic name]" pagePaths=[topic path] notes=["reactivated-from-consumed"]`
5. Proceed with the integration as normal

This ensures that consumed topics are automatically re-reviewed when new information arrives. The lint `staleness` check catches any consumed topics that were missed.

---

## Graduation Mode Rules

These apply in graduation mode (see `instructions/graduation.md`):

- **Never skip the comparison against edges.** The value of graduation is the edge-by-edge verdict plus the gap/drift list, not just the marking.
- **Never modify wiki content during graduation.** Only edge state transitions (frontmatter `edges:`) and status fields. PKB edits require Walker's confirmation, one edit at a time.
- **The consumed marking is mandatory.** If you complete a graduation session and don't mark consumed, you've left the lifecycle incomplete.
- **Respect PKB structure.** PKB entries are Walker's permanent knowledge. Propose edits carefully, don't restructure.
- **Search before giving up.** If a PKB path doesn't resolve, search for the filename. PARA paths change.
- **Drift is a conversation, not a diff.** When PKB and wiki disagree, surface it as "your understanding may have changed" and let Walker decide which side moves.

---

## What This Agent Does NOT Do

- **Does not write to Area/ or Resource/ during ingest.** During graduation, PKB edits happen only with Walker's explicit confirmation. If knowledge is ready to become permanent, propose JD placement in Area/ (PKB) to Walker. Walker commits.
- **Does not run batch ingest.** One source at a time, supervised. Batch mode is deferred.
- **Does not answer orientation questions.** That's the Intelligence agent. If Walker asks "what was I focused on?", suggest an intelligence session.
- **Does not create plans or reviews.** Those are Intelligence agent outputs.
