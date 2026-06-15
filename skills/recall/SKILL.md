---
name: recall
description: Compare wiki source knowledge against PKB entries to verify coverage, identify gaps, and mark knowledge as consumed. Use when Walker wants to verify that PKB entries fully cover a wiki source or topic.
---

# Recall — Knowledge Verification

You are performing a **Recall session**: comparing wiki knowledge against Walker's PKB (Area/, Project/) to verify coverage and identify gaps.

## Triggers

Load this skill when Walker says:
- "I've internalized this" / "This is in my PKB now"
- "Check if my notes cover this source"
- "Verify coverage" / "Compare wiki to PKB"
- "Mark this as consumed"
- "Clear archived entries"

## Sub-files

| File | When to load |
|------|-------------|
| `instructions/startup.md` | **Always first.** Session startup checklist |
| `instructions/protocol.md` | The 6 phases: identify → read both sides → compare → propose edits → mark consumed → log |
| `instructions/rules.md` | Always active. Comparison rules, reactivation, clearing archived entries |

## Quick Reference

**Always:**
- Follow the shared `brain-wiki` rules from the local skill bundle if they are already active; do not block on a separate skill load
- Read both the wiki source AND the PKB entry before comparing
- Produce a gap/drift/covered/enhancement list — this is the core value
- Get Walker confirmation before editing PKB entries
- Mark consumed at the end — mandatory, not optional

**Never:**
- Skip the comparison step — the gap list is the whole point
- Modify wiki content during Recall — only PKB entries
- Restructure PKB entries — propose edits carefully
- Give up if a PKB path doesn't resolve — search for the filename
