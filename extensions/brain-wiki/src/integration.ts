import { appendEvent, markPageStatus, markSourcesIntegrated } from "./log.ts";
import { readCaptureState, updateCaptureState } from "./capture.ts";
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
