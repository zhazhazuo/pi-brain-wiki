import type { PromotionPayload, TaskValidationResult } from "./types.ts";

const VALID_TYPES = ["BUG:", "FEAT:", "RD:", "REVIEW:", "SETUP:", "PLAN:", "MEETING:"];
const VALID_ESTIMATES = [0.5, 1, 1.5, 2, 2.5, 3];
const VALID_PRIORITIES = ["H", "M", "L"];

export function validatePromotion(payload: PromotionPayload): TaskValidationResult {
  const errors: TaskValidationResult["errors"] = [];

  if (!payload.project || !payload.project.includes(".")) {
    errors.push({
      field: "project",
      code: "invalid_project_format",
      message: "Project must be in Domain.SpecificOutcome format with a dot separator.",
    });
  }

  const typeMatch = payload.description.match(/^([A-Z]+):\s*(.+)$/);
  if (!typeMatch) {
    errors.push({
      field: "description",
      code: "missing_type_prefix",
      message: `Description must start with a TYPE prefix: ${VALID_TYPES.join(", ")}`,
    });
  } else {
    const prefix = typeMatch[1] + ":";
    const body = typeMatch[2];
    if (!VALID_TYPES.includes(prefix)) {
      errors.push({
        field: "description",
        code: "invalid_type_prefix",
        message: `Unknown TYPE prefix. Valid: ${VALID_TYPES.join(", ")}`,
      });
    }
    const wordCount = body.trim().split(/\s+/).length;
    if (wordCount > 8) {
      errors.push({
        field: "description",
        code: "description_too_long",
        message: `Description body must be ≤ 8 words (found ${wordCount}).`,
      });
    }
    if (/https?:\/\//.test(body)) {
      errors.push({
        field: "description",
        code: "description_has_url",
        message: "URLs are not allowed in description. Use task annotate instead.",
      });
    }
  }

  if (!VALID_PRIORITIES.includes(payload.priority)) {
    errors.push({
      field: "priority",
      code: "invalid_priority",
      message: "Priority must be H, M, or L.",
    });
  }

  if (!VALID_ESTIMATES.includes(payload.estimate)) {
    errors.push({
      field: "estimate",
      code: "invalid_estimate",
      message: `Estimate must be one of: ${VALID_ESTIMATES.join(", ")}`,
    });
  }

  if (!payload.scheduled) {
    errors.push({
      field: "scheduled",
      code: "missing_scheduled",
      message: "Scheduled date is required.",
    });
  }

  if (!payload.tags || payload.tags.length === 0) {
    errors.push({
      field: "tags",
      code: "missing_tags",
      message: "At least one tag is required.",
    });
  }

  return { valid: errors.length === 0, errors };
}
