---
name: workflow-invoke
description: Use when Walker's request may match a learned Brain Wiki workflow. Routes through Wiki/meta/workflows.md, reads the selected workflow page, and follows it.
---

# Workflow Invoke — Learned Workflow Router

You invoke existing learned workflows from the Brain Wiki. You do not extract new workflows and you do not generate workflow pages.

## Startup Checklist

Before deciding whether to invoke a workflow:

1. Load the `brain-wiki` skill (shared rules) — **required**
2. Read `Wiki/meta/workflows.md` — active and draft workflow routes
3. Match Walker's request against route triggers and summaries
4. If the route table is stale or unclear, use `wiki_search` with `type=workflow`

## Routing Protocol

1. Prefer active workflows over draft workflows.
2. If exactly one active workflow matches, read its workflow page before acting.
3. If multiple workflows match, briefly list the candidates and ask Walker which one to use.
4. If only draft workflows match, ask Walker before invoking one.
5. If no workflow matches, continue with the relevant normal skill instead of inventing a route.

## Invocation Protocol

After selecting a workflow:

1. Read the workflow page.
2. Follow the `## Workflow YAML` block as the source of operational instructions.
3. Apply all constraints in the workflow before taking write actions.
4. Use the broader `brain-wiki` rules for startup, boundary checks, citations, and protected paths.
5. Report which workflow was invoked and the result.

## Rules

- Do not execute a workflow from the route table alone; read the workflow page first.
- Do not modify workflow pages during invocation.
- Do not treat trigger matches as commands to bypass user approvals encoded in the workflow.
- If the workflow conflicts with higher-priority `brain-wiki` rules, follow `brain-wiki` and surface the conflict.
