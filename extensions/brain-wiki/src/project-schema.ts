export const PROJECT_STATUSES = ["idea", "active", "waiting", "blocked", "done", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function buildProjectTemplate(projectTitle: string, now = new Date()): Record<string, string> {
  const date = now.toISOString().slice(0, 10);
  return {
    "project.md": `---
type: project
title: ${projectTitle}
status: idea
created: ${date}
updated: ${date}
area:
priority: medium
deadline:
next_action:
review_after:
resources: []
related_projects: []
tags:
  - project
---

# ${projectTitle}

## Outcome

## Current State

## Next Action

## Active Links
`,
    "tasks.md": `# ${projectTitle} Tasks

## Open
`,
    "timeline.md": `# ${projectTitle} Timeline
`,
    "notes.md": `# ${projectTitle} Notes
`,
  };
}

export function validateProjectFrontmatter(frontmatter: Record<string, unknown>) {
  const errors: string[] = [];
  const type = normalizeScalar(frontmatter.type);
  const status = normalizeScalar(frontmatter.status) as ProjectStatus | "";
  const nextAction = normalizeScalar(frontmatter.next_action);
  if (type !== "project") errors.push("type must be project");
  if (!PROJECT_STATUSES.includes(status as ProjectStatus)) errors.push("status is invalid");
  if ((status === "active" || status === "waiting" || status === "blocked") && !nextAction) {
    errors.push(`next_action is required when status is ${status}`);
  }
  return { ok: errors.length === 0, errors };
}

function normalizeScalar(value: unknown): string {
  if (Array.isArray(value)) {
    return normalizeScalar(value[0]);
  }
  if (value == null) return "";
  return String(value).trim();
}
