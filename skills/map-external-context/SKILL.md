---
name: map-external-context
description: Link PKB notes to local code repositories and gather bounded repo-backed context via wiki_context_resolve and wiki_context_gather. Use when Walker wants repo context for a note, sets up external context, asks how a system is implemented, or mentions brain_wiki_context.
---

# External Context — PKB-to-Repo Integration

Route repo-backed reasoning through extension tools. Never resolve filesystem paths yourself or browse external repos ad hoc.

## Triggers

Load this skill when Walker says:
- "Get repo context for this note" / "Look at the code for [[...]]"
- "Link this PKB note to a repository" / "Set up external context"
- "How is X implemented in the Sales Tool?" (when a context registry entry exists or should exist)
- "Gather architecture / overview / handoff for [system]"
- Walker references `brain_wiki_context` or asks about `.wiki/env.local.json`

## Sub-files

| File | When to load |
|------|-------------|
| `instructions/rules.md` | **Always.** Activation, fail-closed behavior, write boundaries |
| `instructions/setup.md` | Registering a new note ↔ repo link (config + env + frontmatter) |
| `instructions/protocol.md` | Resolve → gather → weave for an existing or newly linked context |

## Quick Reference

**Always:**
- Follow shared `brain-wiki` rules if already active
- Call `wiki_context_resolve` before `wiki_context_gather`
- Use `context_id` or vault-relative `pkb_note` — at least one required for resolve
- Pick intent from Walker's goal; pass `query` for `implementation` and `question`
- Cite gather `evidence` when answering; surface `limits_hit` when bounds were reached

**Never:**
- Explore a repo because a PKB note was merely mentioned in conversation
- Guess repo paths or invent context IDs not in `.wiki/config.json`
- Write absolute local paths into PKB notes or synced wiki pages
- Modify external repositories — gathering is read-only

## Tools

| Tool | Purpose |
|------|---------|
| `wiki_context_resolve` | Validate registry + env mapping; return descriptor (no repo reads) |
| `wiki_context_gather` | Bounded gather by intent against resolved repo |

## Intents

| Intent | Use when | `query` required? |
|--------|----------|-------------------|
| `overview` | What the repo is, structure, stack | No |
| `architecture` | Entrypoints, modules, boundaries | No |
| `implementation` | Locate a feature, symbol, or concept | Yes |
| `recent_changes` | Recent relevant commits | No |
| `question` | Answer one concrete question from repo evidence | Yes |
| `handoff` | Compact brief for another session or agent | No |
