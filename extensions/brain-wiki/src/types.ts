export const PAGE_TYPES = ["summary", "topic", "plan", "review", "workflow"] as const;
export type WikiPageType = (typeof PAGE_TYPES)[number];

export const CANONICAL_PAGE_TYPES = ["topic"] as const;
export type CanonicalPageType = (typeof CANONICAL_PAGE_TYPES)[number];

export type ContextGatherIntent =
  | "overview"
  | "architecture"
  | "implementation"
  | "recent_changes"
  | "question"
  | "handoff";

export interface ExternalContextConfig {
  label: string;
  pkb_note: string;
  repo_key: string;
  allowed_intents: ContextGatherIntent[];
  seed_files?: string[];
  include_paths?: string[];
  exclude_paths?: string[];
  search_terms?: string[];
  notes?: string;
}

export interface LocalEnvConfig {
  repos: Record<string, string>;
}

export interface ResolveExternalContextInput {
  context_id?: string;
  pkb_note?: string;
}

export interface ResolvedExternalContext {
  context_id: string;
  label: string;
  pkb_note: string;
  repo_key: string;
  repo_path: string;
  allowed_intents: ContextGatherIntent[];
  seed_files: string[];
  include_paths: string[];
  exclude_paths: string[];
  search_terms: string[];
  notes?: string;
}

export interface GatherEvidence {
  kind: "file" | "search" | "commit" | "note";
  label: string;
  detail: string;
}

export interface GatherExternalContextInput {
  intent: ContextGatherIntent;
  query?: string;
  readTextFile?: (path: string) => Promise<string>;
  listRepoFiles?: () => Promise<string[]>;
  searchRepo?: (query: string) => Promise<string[]>;
  getRecentCommits?: () => Promise<string[]>;
}

export interface GatherExternalContextResult {
  context_id: string;
  repo_path: string;
  intent: ContextGatherIntent;
  files_read: string[];
  commands_used: string[];
  summary: string[];
  evidence: GatherEvidence[];
  limits_hit: string[];
  follow_up_suggestions: string[];
}

export interface WikiConfig {
  version: number;
  title: string;
  domain: string;
  timezone: string;
  paths: {
    inbox: string;
    pages: string;
    meta: string;
    archive: string;
  };
  pageTypes: Record<WikiPageType, string>;
  templates: Record<WikiPageType, string>;
  linkStyle: string;
  citationStyle: string;
  protect: string[];
  /**
   * Path patterns (relative to wiki root) that agents are allowed
   * to write to, even though they fall outside the wiki directory.
   * E.g. ["../LIST.md"] to allow editing the PARA vault's top-level list.
   */
  allowExternal: string[];
  search: {
    defaultLimit: number;
  };
  contexts: Record<string, ExternalContextConfig>;
}

export interface ParsedPage {
  absolutePath: string;
  relativePath: string;
  frontmatter: Record<string, any>;
  body: string;
  headings: string[];
  rawLinks: string[];
  normalizedLinks: string[];
  wordCount: number;
}

export interface RegistryEntry {
  id: string;
  type: WikiPageType;
  path: string;
  title: string;
  aliases: string[];
  summary?: string;
  status?: string;
  tags: string[];
  updated?: string;
  sourceIds: string[];
  consumedAt?: string;
  pkbRefs?: string[];
  linksOut: string[];
  headings: string[];
  wordCount: number;
  externalBacklinks: number;
  externalSources: string[];
}

export interface RegistryData {
  version: number;
  generatedAt: string;
  pages: RegistryEntry[];
}

export interface BacklinksRecord {
  inbound: string[];
  outbound: string[];
}

export interface BacklinksData {
  version: number;
  generatedAt: string;
  byPath: Record<string, BacklinksRecord>;
}

export type WikiEventKind =
  | "capture"
  | "integrate"
  | "query"
  | "plan"
  | "review"
  | "workflow"
  | "lint"
  | "refactor"
  | "rebuild"
  | "consumed"
  | "archived"
  | "cleared";

export interface WikiEvent {
  ts: string;
  kind: WikiEventKind;
  title: string;
  summary?: string;
  sourceIds?: string[];
  pagePaths?: string[];
  notes?: string[];
  actor?: "agent" | "user" | "extension";
}

export interface LintIssue {
  kind: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}

export interface LintRun {
  mode: string;
  counts: {
    total: number;
    brokenLinks: number;
    orphans: number;
    frontmatter: number;
    duplicates: number;
    coverage: number;
    staleness: number;
  };
  issues: LintIssue[];
  reportPath?: string;
}

export interface SourceManifest {
  version: number;
  sourceId: string;
  title: string;
  kind: string;
  origin: {
    type: "url" | "file" | "text";
    value: string;
  };
  capturedAt: string;
  integratedAt?: string;
  mimeType: string;
  hash: string;
  originalFiles: Array<{
    path: string;
    size: number;
    sha256: string;
  }>;
  extracted: {
    path: string;
    converter: string;
    sha256: string;
  };
  attachments: Array<{
    path: string;
    size?: number;
    sha256?: string;
  }>;
  status: "captured" | "integrated" | "superseded" | "archived" | "consumed" | "cleared";
}

export interface CaptureParams {
  inputType: "url" | "file" | "text";
  value: string;
  title?: string;
  kind?: string;
  tags?: string[];
  createSourcePage?: boolean;
}

export interface CaptureResult {
  sourceId: string;
  packetDir: string;
  manifestPath: string;
  extractedPath: string;
  sourcePagePath?: string;
  title: string;
  status: "captured";
}

export interface EnsurePageParams {
  type: CanonicalPageType;
  title: string;
  aliases?: string[];
  tags?: string[];
  summary?: string;
  date?: string;        // For plan pages: YYYY-MM-DD
  period?: string;      // For review pages: YYYY-Www
  createIfMissing?: boolean;
}

export interface EnsurePageResult {
  resolved: boolean;
  created: boolean;
  conflict: boolean;
  path?: string;
  id?: string;
  title?: string;
  type?: string;
  candidates?: Array<{
    id: string;
    path: string;
    title: string;
    type: string;
  }>;
}

export type WorkflowStatus = "draft" | "active" | "archived";

export interface WorkflowParams {
  title: string;
  status?: WorkflowStatus;
  triggers: string[];
  goal: string;
  inputs: string[];
  steps: string[];
  output: string;
  constraints?: string[];
  tags?: string[];
  summary?: string;
}

export interface WorkflowResult {
  created: boolean;
  conflict: boolean;
  path?: string;
  id?: string;
  title?: string;
  status?: string;
  candidates?: Array<{
    id: string;
    path: string;
    title: string;
    status?: string;
  }>;
}

export interface SearchMatch {
  id: string;
  type: string;
  path: string;
  title: string;
  summary?: string;
  aliases?: string[];
  score: number;
  sourceIds?: string[];
}

export interface SearchResult {
  query: string;
  matches: SearchMatch[];
}

export type GraphZone = "wiki" | "pkb";

export interface GraphNodeCandidate {
  path: string;
  title: string;
  summary?: string;
  aliases: string[];
  tags: string[];
  sourceIds: string[];
  zone: GraphZone;
  score: number;
  backlinks: number;
}

export interface GraphContextResult {
  query: string;
  wiki: GraphNodeCandidate[];
  pkb: GraphNodeCandidate[];
}

export interface GraphNeighborhood {
  path: string;
  title: string;
  backlinks: Array<{ file: string; count: number }>;
  links: string[];
  secondHop: Array<{ file: string; count: number }>;
}

export interface GraphBridgeResult {
  pagePath: string;
  title: string;
  terms: string[];
  currentLinks: string[];
  candidates: GraphNodeCandidate[];
}

export interface StatusSummary {
  totals: {
    allPages: number;
    summary: number;
    topic: number;
    plan: number;
    review: number;
    workflow: number;
  };
  sources: {
    captured: number;
    pendingIntegration: number;
    integrated: number;
    unintegrated: number;
    consumed: number;
    archived: number;
    cleared: number;
  };
  lastCapture?: string;
  lastEvent?: string;
  oldestIntegrated?: string;
  externalBacklinks?: {
    total: number;
    pageCount: number;
    topPage?: { title: string; count: number };
  };
}

export type ListItemCategory = "source" | "task" | "idea" | "meeting-note" | "plan" | "unknown";

export interface ListItem {
  date: string;
  text: string;
  done: boolean;
  inProgress: boolean;
  category: ListItemCategory;
  agentNotes: string[];
  daysSinceCreation: number;
}

export interface ListMdData {
  items: ListItem[];
  unprocessedItems: ListItem[];
  oldestUnprocessedDate: string | null;
  unprocessedSourceUrls: ListItem[];
}

export interface LifecycleBacklog {
  integratedAwaitingRecall: Array<{ path: string; title: string; status: string; integratedAt?: string; daysSinceIntegration: number }>;
  consumedReactivated: Array<{ path: string; title: string; consumedAt: string; newSourceIds: string[] }>;
  clearableCandidates: Array<{ path: string; title: string; reason: "pkb-covered" | "superseded" | "no-active-links"; pkbRefs?: string[] }>;
}

// ── PARA Integration Types ─────────────────────────────────────

export type SyncScope = "area" | "resource" | "projects" | "all";

export interface SyncResult {
  topicsCreated: number;
  topicsUpdated: number;
  pages: string[];
}

export type TriageAction = "read" | "add" | "suggest" | "flag_stale";

export interface TriageResult {
  analysis?: {
    totalItems: number;
    uncheckedItems: number;
    staleItems: number;
    recentItems: number;
  };
  added?: boolean;
  suggestions?: string[];
}

export type ProjectSyncAction =
  | "scan"
  | "create_project"
  | "add_note"
  | "suggest_task"
  | "review"
  | "set_status"
  | "set_next_action"
  | "set_deadline"
  | "link_resource"
  | "relate"
  | "timeline_append"
  | "task_add"
  | "task_update"
  | "task_close"
  | "task_block"
  | "task_promote";

export type ProjectStatus = "idea" | "active" | "waiting" | "blocked" | "done" | "archived";

export interface ProjectValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ProjectReviewSummary {
  blocked: Array<{
    path: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    nextAction: string | null;
    lastAction: string | null;
    updated?: string | null;
  }>;
  noNextAction: Array<{
    path: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    nextAction: string | null;
    lastAction: string | null;
    updated?: string | null;
  }>;
  staleActive: Array<{
    path: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    nextAction: string | null;
    lastAction: string | null;
    updated?: string | null;
  }>;
  archiveCandidates: Array<{
    path: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    nextAction: string | null;
    lastAction: string | null;
    updated?: string | null;
  }>;
}

export interface ProjectSyncResult {
  projects?: Array<{
    path: string;
    mainPath?: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    nextAction: string | null;
    lastAction: string | null;
    updated?: string | null;
  }>;
  review?: {
    counts: {
      idea: number;
      active: number;
      waiting: number;
      blocked: number;
      done: number;
      archived: number;
      unknown: number;
    };
    blocked?: Array<{
      path: string;
      title: string;
      status: string;
    }>;
    noNextAction: Array<{
      path: string;
      title: string;
      status: string;
    }>;
    archiveCandidates: Array<{
      path: string;
      title: string;
      status: string;
    }>;
  };
  projectCreated?: boolean;
  projectPath?: string;
  projectTitle?: string;
  createdFiles?: string[];
  projectUpdated?: boolean;
  taskUpdated?: boolean;
  noteAdded?: boolean;
  taskSuggested?: boolean;
}

// ── Obsidian Client Types ──────────────────────────────────────

export interface ObsidianClientConfig {
  socketPath: string;
  vaultCwd: string;
  timeout: number;
}

export interface BacklinkResult {
  file: string;
  count: number;
}

export interface SearchHit {
  file: string;
  matches: Array<{ line: number; text: string }>;
}

// ── Taskwarrior Integration Types ───────────────────────────────

export interface TaskCliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  parsed?: unknown;
}

export interface TaskExportRecord {
  id: number;
  uuid: string;
  description: string;
  project?: string;
  status: string;
  priority?: string;
  tags?: string[];
  due?: string;
  scheduled?: string;
  start?: string;
  end?: string;
  urgency: number;
  depends?: string[];
  annotations?: Array<{ entry: string; description: string }>;
  recur?: string;
  rtype?: string;
  parent?: string;
  estimate?: number;
}

export interface TaskValidationResult {
  valid: boolean;
  errors: TaskValidationError[];
}

export interface TaskValidationError {
  field: string;
  code: string;
  message: string;
}

export interface PromotionPayload {
  description: string;
  project: string;
  scheduled: string;
  priority: "H" | "M" | "L";
  estimate: number;
  tags: string[];
  due?: string;
  recur?: string;
  dependsOn?: string[];
}

export interface WeekMdSection {
  heading: string;
  rows: Array<Record<string, string | number>>;
}

export interface WeekMdData {
  weekNumber: number;
  weekRange: string;
  refreshedAt: string;
  sections: WeekMdSection[];
}

export interface ScanProposal {
  description: string;
  project: string;
  scheduled: string;
  priority: "H" | "M" | "L";
  estimate: number;
  tags: string[];
  reason: string;
  source: string;
}
