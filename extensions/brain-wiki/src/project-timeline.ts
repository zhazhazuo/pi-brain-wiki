export type ProjectTimelineEventType = "status_change" | "decision" | "milestone" | "risk" | "handoff" | "review";

export function formatTimelineEntry(input: {
  date: string;
  type: ProjectTimelineEventType;
  summary: string;
  links?: string[];
}): string {
  const linkLines = (input.links ?? []).map((link) => `- ${link}`).join("\n");
  return [
    `## ${input.date} · ${input.type}`,
    "",
    input.summary,
    "",
    linkLines,
    "",
  ].join("\n");
}
