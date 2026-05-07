export const PAGE_TYPES = ["summary", "topic", "plan", "review"] as const;
export type WikiPageType = (typeof PAGE_TYPES)[number];

export const CANONICAL_PAGE_TYPES = ["topic"] as const;
export type CanonicalPageType = (typeof CANONICAL_PAGE_TYPES)[number];

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
  search: {
    defaultLimit: number;
  };
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

export interface StatusSummary {
  totals: {
    allPages: number;
    summary: number;
    topic: number;
    plan: number;
    review: number;
  };
  sources: {
    captured: number;
    integrated: number;
    unintegrated: number;
    consumed: number;
    archived: number;
    cleared: number;
  };
  lastCapture?: string;
  lastEvent?: string;
  oldestIntegrated?: string;
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

