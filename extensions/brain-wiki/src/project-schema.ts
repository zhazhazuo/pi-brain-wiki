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
  if (frontmatter.type !== "project") errors.push("type must be project");
  if (!PROJECT_STATUSES.includes(String(frontmatter.status) as ProjectStatus)) errors.push("status is invalid");
  if ((frontmatter.status === "active" || frontmatter.status === "waiting" || frontmatter.status === "blocked")
    && !String(frontmatter.next_action ?? "").trim()) {
    errors.push(`next_action is required when status is ${frontmatter.status}`);
  }
  return { ok: errors.length === 0, errors };
}
