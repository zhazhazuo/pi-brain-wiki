# Rules

## 1. Never skip the comparison

The value of Recall is the gap/drift list, not just the marking.

## 2. Never modify wiki content during Recall

You only modify PKB entries (with confirmation) and wiki status fields.

## 3. The consumed marking is mandatory

If you complete a Recall session and don't mark consumed, you've left the lifecycle incomplete.

## 4. Respect PKB structure

PKB entries are Walker's permanent knowledge. Propose edits carefully, don't restructure.

## 5. Search before giving up

If a PKB path doesn't resolve, search for the filename. PARA paths change.

---

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
