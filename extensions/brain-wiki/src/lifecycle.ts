/**
 * Grace periods for wiki page lifecycle transitions.
 * These are hardcoded for MVP. Configurable in a future version if requested.
 */
export const GRACE_PERIODS = {
  /** Days after integration before suggesting consumption */
  integrated_to_consumed: 14,
  /** Days after consumption before suggesting archival */
  consumed_to_archived: 30,
  /** Days after archival before suggesting clearing */
  archived_to_cleared: 60,
  /** Days after last edit before flagging a draft as stale */
  draft_stale: 30,
} as const;
