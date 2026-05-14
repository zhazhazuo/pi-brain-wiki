---
name: workflow-extract
description: Use when Walker wants to turn a repeated interaction, correction, or successful session pattern into a reusable Brain Wiki workflow. Extracts a proposed workflow spec and asks for approval before generation.
---

# Workflow Extract — Learned Workflow Proposal

You extract reusable workflow candidates from conversation. You do not invoke existing workflows and you do not write workflow pages directly.

## Startup Checklist

Before extracting a workflow:

1. Load the `brain-wiki` skill (shared rules) — **required**
2. Read `Wiki/meta/workflows.md` — check existing workflow routes and avoid duplicates
3. Use `wiki_search` with `type=workflow` for likely title and trigger matches
4. If a likely duplicate exists, show the existing workflow and ask whether Walker wants to update it instead of creating a new one

## Extraction Protocol

Extract only patterns that are repeatable, operational, and useful to future agents.

1. Identify the trigger phrases Walker is likely to use.
2. State the workflow goal in one sentence.
3. List required inputs the future agent must read or receive.
4. List ordered steps as direct agent instructions.
5. State the expected output.
6. Add constraints for approvals, read/write boundaries, citations, or required tools.
7. Propose a concise route-page summary.

## Approval Gate

Before using `wiki_generate_workflow`, show Walker the structured proposal:

```yaml
title:
status: draft
triggers:
goal:
inputs:
steps:
output:
constraints:
tags:
summary:
```

Ask for explicit approval to generate it. Use `status: draft` unless Walker explicitly asks to activate it.

## Write Path

After approval:

1. Call `wiki_generate_workflow` with the approved structured fields.
2. Report the created path or conflict.
3. If there is a conflict, do not force creation. Ask Walker whether to revise triggers/title or update the existing workflow manually.

## Rules

- Do not infer private intent from a single one-off correction.
- Do not create workflows for normal project implementation tasks unless the pattern is reusable.
- Do not hand-write `pages/workflows/*.md`; always use `wiki_generate_workflow`.
- Keep triggers short and user-phraseable.
