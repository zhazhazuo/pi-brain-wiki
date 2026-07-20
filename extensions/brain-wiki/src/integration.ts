import { appendEvent, markPageStatus, markSourcesIntegrated } from "./log.ts";
import { readCaptureState, updateCaptureState } from "./capture.ts";
import { arrayOfStrings, scanWikiPages } from "./indexer.ts";
import type { ParsedPage } from "./types.ts";
import type { ObsidianClient } from "./obsidian-client.ts";

export interface IntegrateCapturedSourceParams {
  pagePaths: string[];
  notes?: string[];
  client?: ObsidianClient | null;
}

export interface IntegrateCapturedSourceResult {
  sourceId: string;
  integratedAt: string;
  pagePaths: string[];
}

export async function integrateCapturedSource(
  root: string,
  sourceId: string,
  params: IntegrateCapturedSourceParams,
): Promise<IntegrateCapturedSourceResult> {
  if (!params.pagePaths.length) {
    throw new Error("wiki_integrate_source requires at least one target page path.");
  }

  const state = await readCaptureState(root, sourceId);
  if (!state) {
    throw new Error(`No capture state found for ${sourceId}.`);
  }
  if (state.status === "integrated") {
    return {
      sourceId,
      integratedAt: state.integratedAt ?? new Date().toISOString(),
      pagePaths: params.pagePaths,
    };
  }
  if (state.status !== "integration_pending" && state.status !== "captured") {
    throw new Error(`Capture ${sourceId} is not ready for integration (status: ${state.status}).`);
  }

  const summaryPage = await findSummaryPageForSource(root, sourceId);
  if (summaryPage) {
    assertLearningArtifacts(summaryPage, sourceId);
  }

  const integratedAt = new Date().toISOString();
  const client = params.client ?? null;

  await updateCaptureState(root, sourceId, {
    status: "integrating",
    integratedAt,
    targetPagePaths: params.pagePaths,
  });

  await markPageStatus(root, params.pagePaths, "integrated", {}, client);
  await markSourcesIntegrated(root, [sourceId], integratedAt, client);

  await appendEvent(
    root,
    {
      ts: integratedAt,
      kind: "integrate",
      title: `Integrated ${sourceId}`,
      sourceIds: [sourceId],
      pagePaths: params.pagePaths,
      actor: "extension",
      notes: [
        `pages=${params.pagePaths.join(",")}`,
        ...(params.notes ?? []),
      ],
    },
    client,
  );

  await updateCaptureState(root, sourceId, {
    status: "integrated",
    integratedAt,
    targetPagePaths: params.pagePaths,
  });

  return {
    sourceId,
    integratedAt,
    pagePaths: params.pagePaths,
  };
}

async function findSummaryPageForSource(root: string, sourceId: string): Promise<ParsedPage | null> {
  const pages = await scanWikiPages(root);
  const match = pages.find((page) => {
    const isSummary =
      page.frontmatter.type === "summary" || page.relativePath.includes("/summaries/");
    if (!isSummary) return false;
    return (
      page.frontmatter.id === sourceId ||
      arrayOfStrings(page.frontmatter.source_ids).includes(sourceId)
    );
  });
  return match ?? null;
}

const PLACEHOLDER_LINK = /\[\[[^\]]*\.\.\.[^\]]*\]\]/;
const REAL_LINK = /\[\[[^\]]+\]\]/;

function assertLearningArtifacts(summaryPage: ParsedPage, sourceId: string): void {
  const problems: string[] = [];

  if (!Object.prototype.hasOwnProperty.call(summaryPage.frontmatter, "edges")) {
    problems.push(
      "frontmatter is missing `edges:` — run the Understand & Connect phase and record each knowledge-boundary question as `- id: edge-N, text: ..., state: open` (use `edges: []` only when the source genuinely opens no edge)",
    );
  }

  const targetsMatch = summaryPage.body.match(/^## Integration targets\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
  const targetsBody = targetsMatch?.[1] ?? "";
  if (!targetsMatch || !REAL_LINK.test(targetsBody) || !REAL_LINK.test(targetsBody.replace(PLACEHOLDER_LINK, ""))) {
    problems.push(
      "`## Integration targets` section has no concrete page link — replace the `[[topics/...]]` placeholder with the real target pages",
    );
  }

  if (!/^## Bridge\s*$/m.test(summaryPage.body)) {
    problems.push(
      "missing `## Bridge` section — persist the platform (what you already know / what is genuinely new / where the edge is) on the summary page",
    );
  }

  if (problems.length > 0) {
    throw new Error(
      [
        `Source ${sourceId} is not ready to integrate. Filing without understanding is blocked:`,
        ...problems.map((problem) => `- ${problem}`),
        `Fix ${summaryPage.relativePath}, then retry wiki_integrate_source.`,
      ].join("\n"),
    );
  }
}
